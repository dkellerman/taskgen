import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { IBM_Plex_Sans } from 'next/font/google';
import { useAuth } from '@/components/AuthProvider';
import Doc from '@/components/Doc';
import Chat from '@/components/Chat';
import clsx from 'clsx';

const font = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export function Layout() {
  const { fetchUser } = useAuth();
  const [tab, setTab] = useState<'doc' | 'chat'>('doc'); // mobile-only
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
        <title>Taskgen</title>
        <base target="_blank" />
        <meta name="description" content="Goals v0" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico?v=2" />
      </Head>

      <div className={font.className}>
        <nav className="bg-blue-950 text-white p-4 flex flex-row items-center">
          <h1 className="text-3xl">Taskgen</h1>
          <div className="flex-1" />
          <div className="md:hidden flex gap-6">
            <button
              className="underline disabled:no-underline"
              onClick={() => setTab('doc')}
              disabled={tab === 'doc'}
            >
              Goals
            </button>
            <button
              className="underline disabled:no-underline"
              onClick={() => setTab('chat')}
              disabled={tab === 'chat'}
            >
              Tasks
            </button>
          </div>
        </nav>

        <main className="flex w-[100dvw] h-[calc(100dvh-80px)] gap-12">
          <section className={clsx('flex-1 flex-col md:block', { hidden: tab === 'chat' })}>
            <Doc />
          </section>
          <section
            className={clsx(
              'flex flex-col w-[600px] border border-gray-300',
              'rounded m-0 md:m-4 md:mr-6 shadow-lg md:block',
              { hidden: tab === 'doc' },
            )}
          >
            <Chat />
          </section>
        </main>
      </div>
    </>
  );
}
