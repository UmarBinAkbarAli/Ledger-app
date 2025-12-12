import Button from "@/components/ui/Button";

export default function TestButtonPage() {
  return (
    <div className="p-4">
      <Button variant="primary">Primary Button</Button>
      <Button variant="ghost">Ghost Button</Button>
      <Button variant="danger">Delete Button</Button>
      <Button loading>Loading Button</Button>
    </div>
  );
}
