export default function EmptyState({ title, body }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div className="max-w-md">
        <h3 className="text-xl font-black">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
      </div>
    </div>
  );
}
