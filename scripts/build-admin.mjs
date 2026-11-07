import { build } from 'esbuild';
import { readFile, mkdir, writeFile, cp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const output = resolve(process.env.ADMIN_OUTPUT_DIR || 'dist-admin');
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) || !key) throw new Error('Configure the public Supabase URL and anon/publishable key.');
let publicKey = key.startsWith('sb_publishable_');
try { publicKey ||= JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'anon'; } catch {}
if (!publicKey) throw new Error('Admin browser builds accept only a public anon/publishable key.');
await mkdir(output, { recursive: true });
await build({ entryPoints: ['admin/app.js'], outfile: join(output, 'app.js'), bundle: true, minify: true,
  format: 'esm', platform: 'browser', target: ['es2022'], sourcemap: false, legalComments: 'none' });
for (const name of ['index.html', 'styles.css', 'brand.svg']) await cp(join('admin', name), join(output, name));
await writeFile(join(output, 'config.js'), 'window.NEARRY_ADMIN_CONFIG = ' + JSON.stringify({supabaseUrl: url, publishableKey: key}) + ';\n');
await writeFile(join(output, '_headers'), '/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src \'self\'; script-src \'self\'; style-src \'self\'; img-src \'self\' data: blob: ' + url + '; connect-src \'self\' ' + url + '; frame-src ' + url + '; frame-ancestors \'none\'; base-uri \'none\'; form-action \'self\'\n');
console.log('Admin assets bundled to ' + output + ' (public configuration only).');
