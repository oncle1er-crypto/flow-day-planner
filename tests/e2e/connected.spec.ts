import { createHash } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL?.trim();
const password = process.env.E2E_PASSWORD?.trim();
const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.trim();
const supabaseKey = (
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY
)?.trim();

async function login(page: Page) {
  await page.goto("/auth");
  await page.getByLabel("Email").first().fill(email!);
  await page.getByLabel("Mot de passe").first().fill(password!);
  await page.getByRole("button", { name: "Se connecter" }).first().click();
  await page.waitForURL(/\/today$/);
  await expect(page.getByRole("heading", { name: "À faire", exact: true })).toBeVisible();
}

function deriveFinancePin(userId: string) {
  const prefix = createHash("md5").update(userId).digest("hex").slice(0, 8);
  const unsigned = Number.parseInt(prefix, 16) >>> 0;
  const signed = unsigned > 0x7fffffff ? unsigned - 0x1_0000_0000 : unsigned;
  return String(Math.abs(signed) % 10_000).padStart(4, "0");
}

async function waitForFinanceGate(page: Page) {
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return (
      text.includes("Code secret requis") ||
      text.includes("Déverrouiller Finances") ||
      text.includes("Ajouter une dette ou une créance")
    );
  });
}

async function ensureFinancePin(page: Page, pin: string) {
  await page.goto("/finance");
  await waitForFinanceGate(page);

  if (await page.getByText("Code secret requis", { exact: true }).isVisible()) {
    await page.goto("/finance-security");
    await expect(page.getByRole("heading", { name: "Créer le code", exact: true })).toBeVisible();

    const inputs = page.locator('input[inputmode="numeric"]');
    await expect(inputs).toHaveCount(2);
    await inputs.nth(0).fill(pin);
    await inputs.nth(1).fill(pin);
    await page.getByRole("button", { name: "Activer le code", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Modifier le code", exact: true }),
    ).toBeVisible();
  }
}

async function unlockFinance(page: Page, pin: string) {
  await page.goto("/finance");
  await waitForFinanceGate(page);

  const addButton = page.getByRole("button", { name: "Ajouter une dette ou une créance" });
  if (await addButton.isVisible()) return;

  await expect(page.getByRole("heading", { name: "Déverrouiller Finances" })).toBeVisible();
  const input = page.locator('input[inputmode="numeric"]').first();
  await input.fill(pin);
  await page.waitForTimeout(250);

  const openButton = page.getByRole("button", { name: "Ouvrir Finances", exact: true });
  if (await openButton.isVisible()) await openButton.click();
  await expect(addButton).toBeVisible();
}

async function getSupabaseAccessToken(page: Page) {
  const token = await page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw) as {
          access_token?: string;
          currentSession?: { access_token?: string };
        };
        const accessToken = parsed.access_token ?? parsed.currentSession?.access_token;
        if (accessToken) return accessToken;
      } catch {
        // Ignore unrelated localStorage entries.
      }
    }
    return null;
  });

  expect(token, "Authenticated Supabase access token should exist").toBeTruthy();
  return token!;
}

function supabaseHeaders(accessToken: string) {
  return {
    apikey: supabaseKey!,
    Authorization: `Bearer ${accessToken}`,
  };
}

async function getSupabaseUserId(request: APIRequestContext, accessToken: string) {
  const url = new URL("/auth/v1/user", supabaseUrl!);
  const response = await request.get(url.toString(), { headers: supabaseHeaders(accessToken) });
  expect(response.ok(), `User lookup failed with HTTP ${response.status()}`).toBeTruthy();
  const body = (await response.json()) as { id?: string };
  expect(body.id, "Authenticated Supabase user id should exist").toBeTruthy();
  return body.id!;
}

type TaskApiRow = { id: string; title: string; status: string };

async function findTaskRows(
  request: APIRequestContext,
  accessToken: string,
  title: string,
): Promise<TaskApiRow[]> {
  const url = new URL("/rest/v1/tasks", supabaseUrl!);
  url.searchParams.set("select", "id,title,status");
  url.searchParams.set("title", `eq.${title}`);

  const response = await request.get(url.toString(), { headers: supabaseHeaders(accessToken) });
  expect(response.ok(), `Task lookup failed with HTTP ${response.status()}`).toBeTruthy();
  return (await response.json()) as TaskApiRow[];
}

async function findTaskById(
  request: APIRequestContext,
  accessToken: string,
  id: string,
): Promise<TaskApiRow | null> {
  const url = new URL("/rest/v1/tasks", supabaseUrl!);
  url.searchParams.set("select", "id,title,status");
  url.searchParams.set("id", `eq.${id}`);

  const response = await request.get(url.toString(), { headers: supabaseHeaders(accessToken) });
  expect(response.ok(), `Task lookup failed with HTTP ${response.status()}`).toBeTruthy();
  const rows = (await response.json()) as TaskApiRow[];
  return rows[0] ?? null;
}

async function deleteTaskById(request: APIRequestContext, accessToken: string, id: string) {
  const url = new URL("/rest/v1/tasks", supabaseUrl!);
  url.searchParams.set("id", `eq.${id}`);

  const response = await request.delete(url.toString(), { headers: supabaseHeaders(accessToken) });
  expect(response.status(), "Task cleanup should delete the E2E row").toBe(204);
  await expect.poll(async () => await findTaskById(request, accessToken, id)).toBeNull();
}

async function findFinanceRows(
  request: APIRequestContext,
  accessToken: string,
  title: string,
): Promise<Array<{ id: string; title: string }>> {
  const url = new URL("/rest/v1/financial_obligations", supabaseUrl!);
  url.searchParams.set("select", "id,title");
  url.searchParams.set("title", `eq.${title}`);

  const response = await request.get(url.toString(), { headers: supabaseHeaders(accessToken) });
  expect(response.ok(), `Finance lookup failed with HTTP ${response.status()}`).toBeTruthy();
  return (await response.json()) as Array<{ id: string; title: string }>;
}

async function cleanupFinanceRow(
  request: APIRequestContext,
  accessToken: string,
  id: string,
  title: string,
) {
  const url = new URL("/rest/v1/financial_obligations", supabaseUrl!);
  url.searchParams.set("id", `eq.${id}`);

  const response = await request.delete(url.toString(), { headers: supabaseHeaders(accessToken) });
  expect(response.status(), "Finance cleanup should delete the test obligation").toBe(204);
  await expect
    .poll(async () => (await findFinanceRows(request, accessToken, title)).length)
    .toBe(0);
}

test.describe("connected regression suite", () => {
  test.skip(!email || !password, "E2E_EMAIL and E2E_PASSWORD are required for connected tests");

  test("authenticated user can navigate core modules", async ({ page }) => {
    await login(page);

    for (const path of [
      "/today",
      "/tasks",
      "/calendar",
      "/habits",
      "/goals",
      "/focus",
      "/assistant",
      "/achievements",
      "/notifications",
      "/settings",
      "/profile",
      "/finance",
      "/finance-security",
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should load successfully`).toBeLessThan(400);
      await expect(page).not.toHaveURL(/\/auth$/);
    }
  });

  test("task CRUD works through the real UI and persists on the server", async ({
    page,
    request,
  }) => {
    test.skip(
      !supabaseUrl || !supabaseKey,
      "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required for task verification",
    );

    await login(page);
    const accessToken = await getSupabaseAccessToken(page);
    const title = `E2E-GATE-${Date.now()}`;
    const editedTitle = `${title}-EDITED`;
    let taskId: string | null = null;

    try {
      await page.getByRole("button", { name: "Ajouter une tâche" }).last().click();
      await expect(page.getByRole("heading", { name: "Nouvelle tâche" })).toBeVisible();
      await page.getByLabel("Titre").fill(title);
      await page.getByRole("button", { name: "Créer", exact: true }).click();

      const card = page.locator("article").filter({ hasText: title }).first();
      await expect(card).toBeVisible();
      await expect
        .poll(async () => (await findTaskRows(request, accessToken, title)).length)
        .toBe(1);
      taskId = (await findTaskRows(request, accessToken, title))[0].id;

      await card.getByRole("button", { name: "Marquer terminée" }).click();
      await expect
        .poll(async () => (await findTaskById(request, accessToken, taskId!))?.status)
        .toBe("done");
      await expect(card.getByRole("button", { name: "Marquer non terminée" })).toBeVisible();

      await card.getByRole("button", { name: "Marquer non terminée" }).click();
      await expect
        .poll(async () => (await findTaskById(request, accessToken, taskId!))?.status)
        .toBe("todo");
      await expect(card.getByRole("button", { name: "Marquer terminée" })).toBeVisible();

      await card.getByText(title, { exact: true }).click();
      await expect(page.getByRole("heading", { name: "Modifier la tâche" })).toBeVisible();
      const titleInput = page.getByLabel("Titre");
      await titleInput.fill("");
      await titleInput.pressSequentially(editedTitle, { delay: 5 });
      await titleInput.press("Tab");
      await expect(titleInput).toHaveValue(editedTitle);
      await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Modifier la tâche" })).toBeHidden();

      await expect
        .poll(async () => (await findTaskById(request, accessToken, taskId!))?.title)
        .toBe(editedTitle);

      await page.goto("/tasks");
      const editedCard = page.locator("article").filter({ hasText: editedTitle }).first();
      await expect(editedCard).toBeVisible();
      await editedCard.getByText(editedTitle, { exact: true }).click();
      await page.getByRole("button", { name: "Supprimer" }).click();
      await expect.poll(async () => await findTaskById(request, accessToken, taskId!)).toBeNull();
      taskId = null;
    } finally {
      if (taskId) await deleteTaskById(request, accessToken, taskId);
    }
  });

  test("protected finance lifecycle supports partial payment, settlement, and cleanup", async ({
    page,
    request,
  }) => {
    test.skip(
      !supabaseUrl || !supabaseKey,
      "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required for finance cleanup",
    );

    await login(page);
    const accessToken = await getSupabaseAccessToken(page);
    const userId = await getSupabaseUserId(request, accessToken);
    const financePin = deriveFinancePin(userId);
    await ensureFinancePin(page, financePin);
    await unlockFinance(page, financePin);

    const title = `E2E-FINANCE-${Date.now()}`;
    let obligationId: string | null = null;

    try {
      await page.getByRole("button", { name: "Ajouter une dette ou une créance" }).click();
      const createDialog = page.getByRole("dialog");
      await expect(createDialog.getByRole("heading", { name: "Nouvelle opération" })).toBeVisible();
      await createDialog.getByRole("button", { name: "On me doit", exact: true }).click();
      await createDialog.getByPlaceholder("Nom ou entreprise").fill("E2E Finance");
      await createDialog.getByPlaceholder("Prêt, achat, facture…").fill(title);
      await createDialog.locator('input[type="number"]').fill("120000");
      await createDialog.locator('input[type="date"]').fill("2099-12-31");
      await createDialog.getByRole("button", { name: "Enregistrer", exact: true }).click();

      const card = page.locator("article").filter({ hasText: title }).first();
      await expect(card).toBeVisible();
      await expect
        .poll(async () => (await findFinanceRows(request, accessToken, title)).length)
        .toBe(1);
      obligationId = (await findFinanceRows(request, accessToken, title))[0].id;

      await expect(card.getByText("Initial", { exact: true }).locator("..")).toContainText(
        /120\s*000/,
      );
      await expect(card.getByText("Payé", { exact: true }).locator("..")).toContainText(/0/);
      await expect(card.getByText("Reste", { exact: true }).locator("..")).toContainText(
        /120\s*000/,
      );

      await card.getByRole("button", { name: "Enregistrer un paiement" }).click();
      const partialPaymentDialog = page.getByRole("dialog");
      await partialPaymentDialog.locator('input[type="number"]').fill("40000");
      await partialPaymentDialog.getByPlaceholder("Espèces, Wave…").fill("E2E paiement partiel");
      await partialPaymentDialog.getByRole("button", { name: "Valider le paiement" }).click();

      await expect(card.getByText("Payé", { exact: true }).locator("..")).toContainText(/40\s*000/);
      await expect(card.getByText("Reste", { exact: true }).locator("..")).toContainText(
        /80\s*000/,
      );
      await expect(card.getByText("En cours", { exact: true })).toBeVisible();

      await card.getByRole("button", { name: "Enregistrer un paiement" }).click();
      const settlementDialog = page.getByRole("dialog");
      await settlementDialog.getByRole("button", { name: /Solder entièrement/ }).click();
      await settlementDialog.getByRole("button", { name: "Valider le paiement" }).click();

      await expect(card.getByText("Soldé", { exact: true })).toBeVisible();
      await expect(card.getByText("Payé", { exact: true }).locator("..")).toContainText(
        /120\s*000/,
      );
      await expect(card.getByText("Reste", { exact: true }).locator("..")).toContainText(/0/);
    } finally {
      if (!obligationId) {
        const rows = await findFinanceRows(request, accessToken, title);
        obligationId = rows[0]?.id ?? null;
      }
      if (obligationId) await cleanupFinanceRow(request, accessToken, obligationId, title);
    }
  });

  test("gamification and AI assistant answer without server errors", async ({ page }) => {
    const serverFailures: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 500) serverFailures.push(`${response.status()} ${response.url()}`);
    });

    await login(page);

    await page.goto("/achievements");
    await expect(page.getByText(/Badges/i).first()).toBeVisible();

    await page.goto("/assistant");
    await page.locator("textarea").first().fill("Demain 9h appeler le dentiste");
    await page.getByRole("button", { name: /Extraire/i }).click();
    await expect(page.getByText("Tâches proposées (1)")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Appeler le dentiste", { exact: true }).first()).toBeVisible();

    expect(serverFailures, `Unexpected 5xx responses: ${serverFailures.join(", ")}`).toEqual([]);
  });

  test("habits, goals, categories, focus and data export complete their real UI lifecycles", async ({
    page,
    request,
  }) => {
    await login(page);
    const suffix = Date.now();
    const habitName = `E2E-HABIT-${suffix}`;
    const goalTitle = `E2E-GOAL-${suffix}`;
    const categoryName = `E2E-CATEGORY-${suffix}`;

    await page.goto("/habits");
    await page.getByRole("button", { name: "Nouvelle", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Nom").fill(habitName);
    await page.getByRole("dialog").getByRole("button", { name: "Créer", exact: true }).click();
    const habit = page.locator("article").filter({ hasText: habitName });
    await expect(habit).toBeVisible();
    await habit.getByRole("button", { name: "Valider aujourd'hui" }).click();
    await expect(habit.getByRole("button", { name: "Annuler aujourd'hui" })).toBeVisible();
    await habit.getByText(habitName, { exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
    await expect(habit).toBeHidden();

    await page.goto("/goals");
    await page.getByRole("button", { name: "Nouvel", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Titre").fill(goalTitle);
    await page.getByRole("dialog").getByRole("button", { name: "Créer", exact: true }).click();
    const goal = page.locator("article").filter({ hasText: goalTitle });
    await expect(goal).toBeVisible();
    await goal.getByRole("button", { name: "Marquer atteint" }).click();
    await expect(goal).toContainText("100%");
    await goal.getByText(goalTitle, { exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
    await expect(goal).toBeHidden();

    await page.goto("/settings");
    await page.getByPlaceholder("Nouvelle catégorie").fill(categoryName);
    await page.getByRole("button", { name: "Ajouter la catégorie" }).click();
    const categoryInput = page.getByLabel(`Nom de la catégorie ${categoryName}`);
    await expect(categoryInput).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: `Supprimer la catégorie ${categoryName}` }).click();
    await expect(categoryInput).toBeHidden();

    const accessToken = await getSupabaseAccessToken(page);
    const userId = await getSupabaseUserId(request, accessToken);
    const financePin = deriveFinancePin(userId);
    await ensureFinancePin(page, financePin);
    await unlockFinance(page, financePin);
    await page.goto("/settings");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exporter mes données" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^flow-day-planner-export-.*\.json$/);

    await page.goto("/focus");
    await page.locator('input[type="number"]').first().fill("1");
    await page.getByRole("button", { name: "Démarrer" }).click();
    await page.waitForTimeout(5_500);
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByText("Historique récent")).toBeVisible();
  });
});
