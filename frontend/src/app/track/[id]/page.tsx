import TrackByIdClient from "./TrackByIdClient";

export function generateStaticParams() {
  return [
    ...Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1) })),
    ...Array.from({ length: 20 }, (_, i) => ({ id: `CP-${1000 + i}` })),
  ];
}

export default function TrackByIdPage() {
  return <TrackByIdClient />;
}
