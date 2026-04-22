const fs = require('fs');

let content = fs.readFileSync('src/pages/Profile.tsx', 'utf8');

const target = `                  </div>
               )}
            </div>
         </div>
      </div>`;

const injectPasswordChange = `                  </div>
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

content = content.replace(target, injectPasswordChange);

fs.writeFileSync('src/pages/Profile.tsx', content);
