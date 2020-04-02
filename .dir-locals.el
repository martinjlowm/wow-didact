((typescript-mode
  . (
     ;; Enable typescript-language-server and eslint LSP clients.
     (lsp-enabled-clients . (ts-ls eslint))
     (eval . (let ((project-directory (car (dir-locals-find-file "."))))
               (set (make-local-variable 'flycheck-javascript-eslint-executable)
                    (concat project-directory ".vscode/pnpify/eslint/bin/eslint.js"))

               ;; (lsp-dependency 'typescript-language-server
               ;;                 `(:system ,(concat project-directory ".vscode/pnpify/typescript-language-server/lib/cli.js")))
               (lsp-dependency 'typescript-language-server
                               `(:system ,(concat project-directory ".pnp/typescript-language-server")))
               (lsp-dependency 'typescript
                               `(:system ,(concat project-directory ".vscode/pnpify/typescript/bin/tsserver")))

               ;; Re-(start) LSP to pick up the dependency changes above.
               (lsp)
               )))))
