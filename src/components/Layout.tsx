import { useEffect, useRef } from "react";
import Head from "next/head";
import { IBM_Plex_Sans } from "next/font/google";
import { useAuth } from "@/components/AuthProvider";
import Doc from "@/components/Doc";
import Chat from "@/components/Chat";

const font = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
});

export function Layout() {
  const { fetchUser } = useAuth();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      fetchUser();
    }
  }, [fetchUser]);

  return (
    <>
      <Head>
        <title>Goals</title>
        <meta name="description" content="Goals v0" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={`${font.className}`}>
        <nav className="bg-blue-200 p-4">
          <h1 className="text-2xl">Goals</h1>
        </nav>

        <main className="flex w-[100dvw] h-[calc(100dvh-80px)]">
          <section className="flex-1 flex-col">
            <Doc />
          </section>
          <section className="flex flex-col w-[600px]">
            <Chat />
          </section>
        </main>
      </div>
    </>
  );
}
