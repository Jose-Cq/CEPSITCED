import { supabase } from './src/config/supabase.js';
import fs from 'fs';

async function run() {
  try {
    const { data: config } = await supabase.from('landing_configuracion').select('*');
    const { data: nosotros } = await supabase.from('landing_nosotros').select('*');
    const { data: carousel } = await supabase.from('landing_carousel').select('*');
    const output = { config, nosotros, carousel };
    fs.writeFileSync('inspect_landing.txt', JSON.stringify(output, null, 2));
    console.log('Done');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
