'use server';

/**
 * HR account actions. SECURITY (Planner 2026-10-08, HR audit): both actions checked the caller's role but never that
 * the TARGET user is of the caller's tenant — a tenant admin could reset the password of, or delete, any user of any
 * tenant by id. Both now run on the caller's scoped client (seraph D7: update/delete carry the tenant scope), so a
 * user of another tenant is simply not found.
 */
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { scopeFromSession } from '@/lib/data/scope';

const ACCOUNT_ADMIN_ROLES = ['SUPERADMIN', 'PLATFORM_ADMIN', 'TENANT_ADMIN'];

export async function resetEmployeePassword(userId: string, newPassword: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Not authenticated' };
  }

  // Ensure caller has admin rights
  const db = await scopeFromSession();
  const caller = await db.user.findFirst({ where: { id: session.user.id }, select: { role: true } });
  if (!ACCOUNT_ADMIN_ROLES.includes(caller?.role || '')) {
    return { error: 'Not authorized' };
  }
  const target = await db.user.findFirst({ where: { id: userId }, select: { id: true } });
  if (!target) return { error: 'Not found' };

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  try {
    await db.user.update({
      where: { id: target.id },
      data: { password: hashedPassword }
    });
    return { success: true };
  } catch (error) {
    console.error('Password reset error:', error);
    return { error: 'Failed to reset password' };
  }
}

export async function deleteEmployee(userId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Not authenticated' };
  }

  const db = await scopeFromSession();
  const caller = await db.user.findFirst({ where: { id: session.user.id }, select: { role: true } });
  if (!ACCOUNT_ADMIN_ROLES.includes(caller?.role || '')) {
    return { error: 'Not authorized' };
  }
  if (userId === session.user.id) return { error: 'Not authorized' };   // never one's own account
  const target = await db.user.findFirst({ where: { id: userId }, select: { id: true } });
  if (!target) return { error: 'Not found' };

  try {
    // Delete Employee profile and User record — both within the caller's tenant
    await db.$transaction(async (tx) => {
      await tx.employee.deleteMany({ where: { userId: target.id } });
      await tx.user.delete({ where: { id: target.id } });
    });
    return { success: true };
  } catch (error) {
    console.error('Delete user error:', error);
    return { error: 'Failed to delete user' };
  }
}
