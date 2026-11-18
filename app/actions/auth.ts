"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export type SignInState = { error?: string };

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email or password is incorrect." };
    }
    throw error;
  }
  return {};
}

export async function signOutAction() {
  await signOut({ redirectTo: "/sign-in" });
}
