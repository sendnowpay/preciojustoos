import BottomNav from "@/components/layout/BottomNav";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <><div>{children}</div><BottomNav /></>;
}
