import 'server-only';
import { cache } from 'react';
import { serverClient } from './supabase/server';
import { getAcademy, type Academy } from './branding-server';

export type Role = 'owner' | 'trainer' | 'player';

/**
 * Who is looking, at which academy, as what. Once per render.
 *
 * `staff` is owner or trainer — everyone who sees the dashboard. `canBrand`
 * is the owner, or a platform admin (the admins table from 0002), who can
 * brand any academy.
 */
export const getViewer = cache(async () => {
  const { slug, academy } = await getAcademy();
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  let role: Role | null = null;
  let isAdmin = false;
  if (user) {
    const [member, admin] = await Promise.all([
      academy ? db.from('academy_members').select('role').eq('academy_id', academy.id).eq('user_id', user.id).maybeSingle()
              : Promise.resolve({ data: null }),
      db.from('admins').select('user_id').eq('user_id', user.id).maybeSingle(),
    ]);
    role = (member.data?.role as Role | undefined) ?? null;
    isAdmin = !!admin.data;
  }
  const staff = role === 'owner' || role === 'trainer';
  return {
    db, user, slug, academy: academy ?? null as Academy | null, role, staff, isAdmin,
    canBrand: !!academy && (role === 'owner' || isAdmin),
  };
});
