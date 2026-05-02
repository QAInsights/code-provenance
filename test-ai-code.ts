// This file is for testing AI code detection
// Try pasting AI-generated code here to see if it gets detected

export async function authenticateUser(email: string, password: string): Promise<User> {
  const user = await db.users.findOne({ email });
  if (!user) {
    throw new Error('User not found');
  }
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid password');
  }
  return user;
}

interface User {
  id: string;
  email: string;
  passwordHash: string;
}

// Made with Bob
