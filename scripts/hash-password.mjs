// Usage: node scripts/hash-password.mjs "your-password"
// Prints a bcrypt hash you can paste into the admins table.
import bcrypt from 'bcryptjs';

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: node scripts/hash-password.mjs "your-password"');
  process.exit(1);
}

const hash = await bcrypt.hash(pw, 10);
console.log(hash);
