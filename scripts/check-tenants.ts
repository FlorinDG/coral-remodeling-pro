import { PrismaClient } from '@prisma/client';

async function main() {
  const p = new PrismaClient();

  // ── Step 1: Update Coral Enterprises with new production credentials ──
  console.log('=== Updating BV CORAL ENTERPRISES ===');
  
  // First, log old values for reference
  const coralBefore = await p.tenant.findUnique({
    where: { id: 'cmneyas2b0000veqvkgl2luz1' },
    select: { eInvoiceTenantId: true, eInvoiceApiKey: true, peppolRegistered: true, peppolId: true },
  });
  console.log('Old values:', JSON.stringify(coralBefore, null, 2));

  const coralResult = await p.tenant.update({
    where: { id: 'cmneyas2b0000veqvkgl2luz1' },
    data: {
      eInvoiceTenantId: 'ten-hgwrzj0coqkqytib',
      eInvoiceApiKey: 'api-kpwthzt90fxlnfykyvncgivrb9t09tib',
      peppolRegistered: true,  // SMP lookup confirms they're on the network
      peppolId: '0208:1018865828',
    },
    select: {
      companyName: true, eInvoiceTenantId: true, eInvoiceApiKey: true,
      peppolRegistered: true, peppolId: true,
    },
  });
  console.log('New values:', JSON.stringify(coralResult, null, 2));

  // ── Step 2: Set Murgu's peppolId ──
  console.log('\n=== Updating Murgu, Catalin ===');

  const murguBefore = await p.tenant.findUnique({
    where: { id: 'cmoa44mjn0000js04xzgk57x0' },
    select: { peppolId: true, peppolRegistered: true },
  });
  console.log('Old values:', JSON.stringify(murguBefore, null, 2));

  const murguResult = await p.tenant.update({
    where: { id: 'cmoa44mjn0000js04xzgk57x0' },
    data: {
      peppolId: '0208:0538483325',
    },
    select: {
      companyName: true, peppolId: true, peppolRegistered: true,
    },
  });
  console.log('New values:', JSON.stringify(murguResult, null, 2));

  await p.$disconnect();
  console.log('\n✅ Done.');
}

main();
