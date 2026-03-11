"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser, isLoggedIn } from "../lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    const user = getUser();
    if (user?.role === "hr") {
      router.replace("/dashboard");
    } else {
      router.replace("/portal");
    }
  }, [router]);

  return null;
}