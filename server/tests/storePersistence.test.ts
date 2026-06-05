import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createStore, createPostgresStoreForTests } from '../src/store/createStore.js';
import { AuthService } from '../src/auth/service.js';
import { PeopleService } from '../src/people/service.js';
import { seedPerson } from './testHelpers.js';

const testDbUrl = process.env.TEST_DATABASE_URL?.trim();
const testEmail = () => `persist-${randomUUID()}@example.com`;

async function wipePersistTestRows(): Promise<void> {
  if (!testDbUrl) return;
  const prev = process.env.DATABASE_URL;
  process.env.DATABASE_URL = testDbUrl;
  const prisma = new PrismaClient();
  try {
    await prisma.magicLink.deleteMany({ where: { email: { startsWith: 'persist-' } } });
    await prisma.magicLinkCooldown.deleteMany({ where: { email: { startsWith: 'persist-' } } });
    await prisma.person.deleteMany({ where: { email: { startsWith: 'persist-' } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'persist-' } } });
  } finally {
    await prisma.$disconnect();
    if (prev) process.env.DATABASE_URL = prev;
    else delete process.env.DATABASE_URL;
  }
}

describe('store persistence', () => {
  describe('MemoryStore fallback', () => {
    it('createStore uses memory when DATABASE_URL is unset', async () => {
      const saved = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      const bundle = await createStore();
      expect(bundle.storeType).toBe('memory');
      const stats = await bundle.store.getRuntimeStats();
      expect(stats.people).toBe(0);
      await bundle.disconnect?.();
      if (saved) process.env.DATABASE_URL = saved;
    });

    it('people do not survive a new MemoryStore instance', async () => {
      const email = testEmail();
      const store1 = createMemoryStore();
      await seedPerson(store1, { email, role: 'player' });
      expect(await store1.getPersonByEmail(email)).toBeTruthy();

      const store2 = createMemoryStore();
      expect(await store2.getPersonByEmail(email)).toBeNull();
    });

    it('users do not survive a new MemoryStore instance', async () => {
      const email = testEmail();
      const store1 = createMemoryStore();
      const user = await store1.createUser(email, 'Persist');
      expect((await store1.getUserByEmail(email))?.id).toBe(user.id);

      const store2 = createMemoryStore();
      expect(await store2.getUserByEmail(email)).toBeNull();
    });
  });

  describe.skipIf(!testDbUrl)('PostgresStore', () => {
    afterEach(async () => {
      await wipePersistTestRows();
    });

    it('person survives store re-instantiation', async () => {
      const email = testEmail();
      const bundle1 = await createPostgresStoreForTests();
      await seedPerson(bundle1.store, { email, role: 'host', status: 'active' });
      await bundle1.disconnect?.();

      const bundle2 = await createPostgresStoreForTests();
      const person = await bundle2.store.getPersonByEmail(email);
      expect(person?.email).toBe(email);
      expect(person?.role).toBe('host');
      const stats = await bundle2.store.getRuntimeStats();
      expect(stats.people).toBeGreaterThanOrEqual(1);
      await bundle2.disconnect?.();
    });

    it('user survives store re-instantiation', async () => {
      const email = testEmail();
      const bundle1 = await createPostgresStoreForTests();
      const user = await bundle1.store.createUser(email, 'Persist User');
      await bundle1.disconnect?.();

      const bundle2 = await createPostgresStoreForTests();
      const loaded = await bundle2.store.getUserByEmail(email);
      expect(loaded?.id).toBe(user.id);
      const stats = await bundle2.store.getRuntimeStats();
      expect(stats.users).toBeGreaterThanOrEqual(1);
      await bundle2.disconnect?.();
    });

    it('people list survives store re-instantiation', async () => {
      const email = testEmail();
      const bundle1 = await createPostgresStoreForTests();
      await seedPerson(bundle1.store, { email, role: 'player', status: 'invited' });
      const list1 = await bundle1.store.listPeople();
      expect(list1.some((p) => p.email === email)).toBe(true);
      await bundle1.disconnect?.();

      const bundle2 = await createPostgresStoreForTests();
      const list2 = await bundle2.store.listPeople();
      expect(list2.some((p) => p.email === email)).toBe(true);
      await bundle2.disconnect?.();
    });

    it('magic link create/verify flow works with Postgres store', async () => {
      const email = testEmail();
      const bundle1 = await createPostgresStoreForTests();
      const people = new PeopleService(bundle1.store);
      const auth = new AuthService(bundle1.store, people);
      await seedPerson(bundle1.store, { email, role: 'player', status: 'invited' });

      const { devLink } = await auth.requestMagicLink(email);
      const token = new URL(devLink!, 'http://localhost:5173').searchParams.get('token')!;
      const session = await auth.verifyMagicLink(token);
      expect(session.length).toBeGreaterThan(10);

      const user = await bundle1.store.getUserByEmail(email);
      expect(user).toBeTruthy();
      await bundle1.disconnect?.();

      const bundle2 = await createPostgresStoreForTests();
      const auth2 = new AuthService(bundle2.store, new PeopleService(bundle2.store));
      expect(await bundle2.store.getUserByEmail(email)).toBeTruthy();
      await expect(auth2.verifyMagicLink(token)).rejects.toThrow(/already used/i);
      await bundle2.disconnect?.();
    });

    it('createStore selects postgres when DATABASE_URL is set', async () => {
      const saved = process.env.DATABASE_URL;
      process.env.DATABASE_URL = testDbUrl!;
      const bundle = await createStore();
      expect(bundle.storeType).toBe('postgres');
      await bundle.disconnect?.();
      if (saved) process.env.DATABASE_URL = saved;
      else delete process.env.DATABASE_URL;
    });
  });
});
