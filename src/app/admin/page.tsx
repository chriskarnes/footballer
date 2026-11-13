import { redirect } from 'next/navigation';

/** Brand settings moved into the trainer area; old links still land there. */
export default function AdminPage() {
  redirect('/coach/brand');
}
