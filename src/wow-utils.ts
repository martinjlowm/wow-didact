import { Event, Frame, FrameType, Layer, LayeredRegion, Point, Region } from 'wow-classic-declarations';

interface PointDefinition {
  point: Point;
  relativePoint: Point;
  relativeFrame: Region;
  x: number;
  y: number;
}

interface Props {
  DrawLayer: Layer;
  inheritsFrom: any;
  point: any;
  points: any;
}

const frameCache: Record<string, Region[]> = {};

function getCache(type: string): Region | undefined {
  // if (frameCache[type]) {
  //   return frameCache[type].length ? frameCache[type].pop() : undefined;
  // }
  return undefined;
}

function setCache(frame: Region): void {
  const type = frame.GetObjectType();
  console.log('store cache', type);
  if (frameCache[type] && frameCache[type].length) {
    frameCache[type].push(frame);
  } else {
    frameCache[type] = [frame];
  }
}

export function sentenceCase(str: string) {
  return str[0].toUpperCase() + str.slice(1).toLowerCase();
}

export function pascalCase(kebabCase: string) {
  return kebabCase.split('-').map(sentenceCase).join('');
}

export function createFrame(jsxType: string, parentFrame: Region, props: Props): Region {
  const frameType = pascalCase(jsxType);

  let frame = getCache(frameType);

  if (frame) {
    console.log('got frame from cache', frameType, frame, 'parent:', parentFrame);
    frame.SetParent(parentFrame);
    frame.Show();
    return frame;
  }

  if (frameType === 'FontString') {
    frame = (parentFrame as Frame).CreateFontString(name, props.DrawLayer || 'ARTWORK', props.inheritsFrom);
  } else if (frameType === 'Texture') {
    frame = (parentFrame as Frame).CreateTexture(name, props.DrawLayer || 'ARTWORK', props.inheritsFrom);
  } else {
    frame = CreateFrame(frameType as FrameType, name, parentFrame, props.inheritsFrom) as Frame;
  }
  // frame.SetParent(parentFrame);
  console.log('created frame:', frameType);
  return frame;
}

export function cleanupFrame(frame: Region): void {
  console.log('cleaning up frame', frame.GetObjectType(), frame);
  frame.Hide();
  frame.ClearAllPoints();
  if ((frame.GetObjectType() as string) === 'Texture' || (frame.GetObjectType() as string) === 'FontString') {
    frame.SetParent(UIParent);
  } else {
    frame.SetParent(null);
  }
  setCache(frame);
}

const isEvent = (name: string): boolean => name.startsWith('On');

/**
 * These properties must be set _before_ their other properties e.g. Background
 * must be set before BackgroundColor
 */
const isOrderedProperty = (name: string): boolean =>
  name === 'Font' || name === 'Background' || name === 'Texture' || name === 'Backdrop';

const isStandardProperty = (name: string): boolean =>
  !isEvent(name) &&
  !isOrderedProperty(name) &&
  name !== 'children' &&
  name !== 'Points' &&
  name !== 'Point' &&
  name !== 'name' &&
  name !== 'DrawLayer' &&
  name !== 'inheritsFrom' &&
  name !== 'Clickable' &&
  name !== 'Draggable';
/**
 * These properties take table values, which should be set verbatim. Array
 * values will apply each item as an argument to SetX. These values should not
 * be interpreted as arrays.
 */
const isTableValue = (name: string): boolean => name === 'Backdrop';

function setPoint(frame: Region, pointDef: PointDefinition): void {
  if (typeof pointDef === 'string') {
    frame.SetPoint(pointDef);
  } else {
    const { point, relativePoint, relativeFrame, x, y } = pointDef;
    const relativeTo = relativePoint || point;
    // console.log('setPoint', Object.keys(pointDef).join(', '));
    if (relativeFrame) {
      frame.SetPoint(point, relativeFrame, relativeTo, x || 0, y || 0);
    } else {
      const parent = frame.GetParent() as Region;
      frame.SetPoint(point, parent, relativeTo, x || 0, y || 0);
    }
  }
}

function attemptSetProperty(frame: Region, key: string, value: any): void {
  const region = (frame as any) as Record<string, (v: any) => void>;
  const setter = `Set${key}`;
  const setterFn = region[setter];
  assert(setterFn, `Tried to use ${setter} and it did not exist`);

  if (setterFn && typeof setterFn == 'function') {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || isTableValue(key)) {
      region[setter](value);
    } else {
      // console.log( `calling ${setter} with array elements as args:`,
      // (value as any[]).join(', '));
      setterFn.apply(region, value);
    }
  }
}

function updateOrderSpecificProperties(frame: Region, prevProps: Props, nextProps: Props): void {
  // Remove properties that are no longer specified
  Object.keys(prevProps)
    .filter((key) => isOrderedProperty(key) && !nextProps[key])
    .forEach((key) => {
      attemptSetProperty(frame, key, null);
    });
  // Set properties
  Object.keys(nextProps)
    .filter(isOrderedProperty)
    .forEach((key) => {
      attemptSetProperty(frame, key, nextProps[key]);
    });
}

function updateRemainingProperties(frame: Region, prevProps: Props, nextProps: Props): void {
  // Remove properties that are no longer specified
  Object.keys(prevProps)
    .filter((key) => isStandardProperty(key) && !nextProps[key])
    .forEach((key) => {
      attemptSetProperty(frame, key, null);
    });
  // Set properties
  Object.keys(nextProps)
    .filter(isStandardProperty)
    .forEach((key) => {
      attemptSetProperty(frame, key, nextProps[key]);
    });
}

function updateFrameEvents(frame: Region, prevProps: Props, nextProps: Props): void {
  // Detach removed event listeners
  Object.keys(prevProps)
    .filter((key) => isEvent(key) && !nextProps[key])
    .forEach((event) => {
      (frame as Frame).SetScript(event as Event.OnAny, undefined);
    });

  if (nextProps['Clickable']) {
    (frame as any).RegisterForClicks('RightButton');
  }
  if (nextProps['Draggable']) {
    (frame as any).RegisterForDrag(...nextProps['Draggable']);
  }

  // Add new event listeners
  Object.keys(nextProps)
    .filter((key) => isEvent(key) && prevProps[key] !== nextProps[key])
    .forEach((event) => {
      (frame as Frame).SetScript(event as Event.OnAny, nextProps[event]);
    });
}

/** Handle frame points, size to parent unless specified. */
function updateFramePoints(frame: Region, nextProps: any): void {
  frame.ClearAllPoints();

  if (nextProps.Point) {
    setPoint(frame, nextProps.Point);
    return;
  }

  if (nextProps.Points) {
    const points = nextProps.Points;
    points.forEach((pointDef: PointDefinition) => setPoint(frame, pointDef));
  } else {
    frame.SetAllPoints();
  }
}

/** Handle frame points, size to parent unless specified. */
function updateFrameLayer(frame: Region, nextProps: Props): void {
  const region = frame as LayeredRegion;
  const layer = nextProps.DrawLayer;

  if (!layer || typeof region.SetDrawLayer !== 'function') {
    return;
  }

  if (layer === 'BACKGROUND' || layer === 'OVERLAY' || layer === 'ARTWORK') {
    region.SetDrawLayer(layer, 0);
    return;
  }

  region.SetDrawLayer(layer[0] as Layer, layer[1]);
}

export function updateFrameProperties(frame: Region, prevProps: Props, nextProps: Props): void {
  updateFramePoints(frame, nextProps);
  updateFrameLayer(frame, nextProps);
  updateFrameEvents(frame, prevProps, nextProps);
  updateOrderSpecificProperties(frame, prevProps, nextProps);
  updateRemainingProperties(frame, prevProps, nextProps);
}

/** Create a point declaration */
export function P(
  point: Point,
  x?: number,
  y?: number,
  relativePoint?: Point,
  relativeFrame?: Region,
): PointDefinition {
  // TODO: memoize for perf
  return { point, relativePoint, relativeFrame, x, y };
}
