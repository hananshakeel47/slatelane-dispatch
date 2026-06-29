export default function Navbar() {
  return (
    <nav className="w-full flex items-center justify-between px-8 py-6 bg-black text-white border-b border-gray-800">
      <h1 className="text-2xl font-bold">
        SlateLane Dispatch
      </h1>

      <button className="bg-blue-600 hover:bg-blue-700 transition px-5 py-2 rounded-full">
        Contact
      </button>
    </nav>
  );
}