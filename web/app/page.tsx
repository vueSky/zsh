import dynamic from "next/dynamic";

const Workspace = dynamic(() => import("../components/Workspace"), {
  ssr: false,
});

export default function Page() {
  return <Workspace />;
}
