'use server';

import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';

export async function resetEmployeePassword(userId: string, newPassword: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Not authenticated' };
  }

  // Ensure caller has admin rights
  const caller = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!['SUPERADMIN', 'PLATFORM_ADMIN', 'TENANT_ADMIN'].includes(caller?.role || '')) {
    return { error: 'Not authorized' };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  try {
    await prisma.user.update({
      where: { id: userId },
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

  const caller = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!['SUPERADMIN', 'PLATFORM_ADMIN', 'TENANT_ADMIN'].includes(caller?.role || '')) {
    return { error: 'Not authorized' };
  }

  try {
    // Delete Employee profile and User record
    await prisma.$transaction([
      prisma.employee.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } })
    ]);
    return { success: true };
  } catch (error) {
    console.error('Delete user error:', error);
    return { error: 'Failed to delete user' };
  }
}
