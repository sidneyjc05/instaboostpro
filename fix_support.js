import fs from 'fs';

const file = 'src/components/admin/AdminSupport.tsx';
let text = fs.readFileSync(file, 'utf8');

text = text.replace('{m.message}', '{m.image_url && <img src={m.image_url} alt="anexo" className="max-w-[200px] rounded-lg mb-2" />}\\n                                            {m.message}');

fs.writeFileSync(file, text);
console.log('Replaced m.message');
