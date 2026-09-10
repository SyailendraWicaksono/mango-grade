import dynamic from "next/dynamic";
import Head from "next/head";
const Mango = dynamic(() => import("../components/MangoSize_Dashboard_Component"), { ssr: false });

export default function Home(){
  return (
    <>
      <Head><title>Main Dashboard</title></Head>
      <Mango />
    </>
  );
}
