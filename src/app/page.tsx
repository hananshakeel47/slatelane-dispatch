import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-black flex flex-col items-center justify-center text-white text-center px-6">
        <h1 className="text-6xl font-extrabold leading-tight">
          SlateLane Dispatch
        </h1>

        <p className="mt-6 text-xl text-gray-300 max-w-2xl">
          Keep Your Wheels Moving.
          <br />
          We Handle The Rest.
        </p>

        <button className="mt-10 bg-blue-600 hover:bg-blue-700 transition px-8 py-4 rounded-full text-lg font-semibold">
          Book Free Consultation
        </button>
      </main>
    </>
  );
}