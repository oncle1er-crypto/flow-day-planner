import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL?.trim();
const password = process.env.E2E_PASSWORD?.trim();

async function login(page: import("@playwright/test").Page) {
  await page.goto("/auth");
  await page.getByLabel("Email").first().fill(email!);
  await page.getByLabel("Mot de passe").first().fill(password!);
  await page.getByRole("button", { name: "Se connecter" }).first().click();
  await page.waitForURL(/\/today$/);
  await expect(page.getByText("À faire aujourd'hui")).toBeVisible();
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
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should load successfully`).toBeLessThan(400);
      await expect(page).not.toHaveURL(/\/auth$/);
    }
  });

  test("task CRUD works through the real UI", async ({ page }) => {
    await login(page);
    const title = `E2E-GATE-${Date.now()}`;
    const editedTitle = `${title}-EDITED`;

    await page.getByRole("button", { name: "Ajouter une tâche" }).last().click();
    await expect(page.getByRole("heading", { name: "Nouvelle tâche" })).toBeVisible();
    await page.getByLabel("Titre").fill(title);
    await page.getByRole("button", { name: "Créer", exact: true }).click();

    const card = page.locator("article").filter({ hasText: title }).first();
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "Marquer terminée" }).click();
    await expect(card.getByRole("button", { name: "Marquer non terminée" })).toBeVisible();
    await card.getByRole("button", { name: "Marquer non terminée" }).click();
    await expect(card.getByRole("button", { name: "Marquer terminée" })).toBeVisible();

    await card.getByText(title, { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Modifier la tâche" })).toBeVisible();
    await page.getByLabel("Titre").fill(editedTitle);
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();

    const editedCard = page.locator("article").filter({ hasText: editedTitle }).first();
    await expect(editedCard).toBeVisible();
    await editedCard.getByText(editedTitle, { exact: true }).click();
    await page.getByRole("button", { name: "Supprimer" }).click();
    await expect(page.getByText(editedTitle, { exact: true })).toHaveCount(0);
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
    await expect(page.getByText("Appeler le dentiste", { exact: true })).toBeVisible();

    expect(serverFailures, `Unexpected 5xx responses: ${serverFailures.join(", ")}`).toEqual([]);
  });
});
