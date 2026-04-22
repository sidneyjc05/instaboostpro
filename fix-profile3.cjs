const fs = require('fs');
let content = fs.readFileSync('src/pages/Profile.tsx', 'utf8');
const searchFor = "                  </div>\n               )}\n            </div>\n         </div>\n      </div>";
const lines = content.split('\n');
let modified = [];
let i = 0;
while(i < lines.length) {
    if (lines[i].includes('                  </div>') && 
        lines[i+1].includes('               )}') &&
        lines[i+2].includes('            </div>') &&
        lines[i+3].includes('         </div>') &&
        lines[i+4].includes('      </div>')) {
        
        console.log("Found at line", i);
        modified.push(lines[i]);
        modified.push(lines[i+1]);
        modified.push(lines[i+2]);
        modified.push("");
        modified.push(         `            {user.email && user.is_verified && (`);
        modified.push(         `               <div className="p-4 bg-secondary/30 rounded-2xl flex flex-col gap-3 mt-4">`);
        modified.push(         `                  <div className="flex flex-col gap-1">`);
        modified.push(         `                     <span className="text-sm text-muted-foreground">Senha</span>`);
        modified.push(         `                     <span className="font-bold">********</span>`);
        modified.push(         `                  </div>`);
        modified.push(         ``);
        modified.push(         `                  <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-border/50">`);
        modified.push(         `                     {!showPasswordChange ? (`);
        modified.push(         `                        <Button variant="outline" onClick={handleChangePassword} isLoading={actionLoading}>`);
        modified.push(         `                           Trocar Senha`);
        modified.push(         `                        </Button>`);
        modified.push(         `                     ) : (`);
        modified.push(         `                        <div className="flex flex-col gap-4 p-4 bg-card border border-border shadow-sm rounded-xl">`);
        modified.push(         `                           <p className="text-xs font-bold text-center">Enviamos um código para seu e-mail.</p>`);
        modified.push(         `                           <div className="flex justify-center"><OTPInput value={codeInput} onChange={setCodeInput} /></div>`);
        modified.push(         `                           <Input type="password" placeholder="Nova Senha" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />`);
        modified.push(         `                           <Button variant="primary" onClick={handleUpdatePassword} isLoading={actionLoading}>Atualizar Senha</Button>`);
        modified.push(         `                           <button onClick={() => setShowPasswordChange(false)} className="text-xs text-muted-foreground mt-1 hover:underline">Cancelar</button>`);
        modified.push(         `                        </div>`);
        modified.push(         `                     )}`);
        modified.push(         `                  </div>`);
        modified.push(         `               </div>`);
        modified.push(         `            )}`);
        
        modified.push(lines[i+3]);
        modified.push(lines[i+4]);
        
        i += 5;
    } else {
        modified.push(lines[i]);
        i++;
    }
}

fs.writeFileSync('src/pages/Profile.tsx', modified.join('\n'));
console.log("Done.");
