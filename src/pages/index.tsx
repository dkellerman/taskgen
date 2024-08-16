import { AuthProvider } from "@/components/AuthProvider";
import { Layout } from "@/components/Layout";

export default function Home() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  );
}
