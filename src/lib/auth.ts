import { pb } from './pb'

export async function signInWithEmail(email: string) {
  // Logic for sign in. In this app we use authWithPassword in Login.tsx
  console.log('signInWithEmail called for', email)
}

export async function signOut() {
  pb.authStore.clear()
}
