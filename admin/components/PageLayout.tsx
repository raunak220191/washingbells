"use client";
import Sidebar from "./Sidebar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";

export default function PageLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen bg-gray-50">
        <div className="px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}
