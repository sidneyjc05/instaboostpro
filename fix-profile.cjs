const fs = require('fs');

let content = fs.readFileSync('src/pages/Profile.tsx', 'utf8');

// Replace imports
if (!content.includes('OTPInput')) {
   content = content.replace(
     `import { Input } from '../components/ui/Input';`,
     `import { Input } from '../components/ui/Input';\nimport { OTPInput } from '../components/ui/OTPInput';`
   );
}

// Email verif replacement
content = content.replace(
  /<p className="text-xs font-bold text-center">Digite o código recebido[^]*?Validar\s*<\/Button>\s*<\/div>/,
  `<p className="text-xs font-bold text-center">Digite o código recebido</p>
                           <div className="flex flex-col gap-4 mt-2">
                              <OTPInput value={codeInput} onChange={setCodeInput} />
                              <Button variant="primary" onClick={handleVerifyEmail} isLoading={actionLoading} className="w-full">Validar</Button>
                           </div>`
);

// Append Password Change
const injectPasswordChange = `                 </div>
               )}
            </div>

            {user.email && user.is_verified && (
               <div className="p-4 bg-secondary/30 rounded-2xl flex flex-col gap-3 mt-4">
                  <div className="flex flex-col gap-1">
                     <span className="text-sm text-muted-foreground">Senha</span>
                     <span className="font-bold">********</span>
                  </div>

                  <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-border/50">
                     {!showPasswordChange ? (
                        <Button variant="outline" onClick={handleChangePassword} isLoading={actionLoading}>
                           Trocar Senha
                        </Button>
                     ) : (
                        <div className="flex flex-col gap-4 p-4 bg-card border border-border shadow-sm rounded-xl">
                           <p className="text-xs font-bold text-center">Enviamos um código para seu e-mail.</p>
                           <OTPInput value={codeInput} onChange={setCodeInput} />
                           <Input type="password" placeholder="Nova Senha" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
                           <Button variant="primary" onClick={handleUpdatePassword} isLoading={actionLoading}>Atualizar Senha</Button>
                           <button onClick={() => setShowPasswordChange(false)} className="text-xs text-muted-foreground mt-1 hover:underline">Cancelar</button>
                        </div>
                     )}
                  </div>
               </div>
            )}
         </div>
      </div>`;

content = content.replace(
  /                  <\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/,
  injectPasswordChange
);

// Second attempt at replacing end of container if first didn't work
if (!content.includes('Trocar Senha')) {
   content = content.replace(
  /                  <\/div>\s*\)}\s*<\/div>\s*<\/div>\s*<\/div>/,
  injectPasswordChange
   );
}


fs.writeFileSync('src/pages/Profile.tsx', content);
