import { expect, test } from "@playwright/test";

test("authentication page renders Flow Day Planner branding", async ({ page }) => {
  await page.goto("/auth");
  await expect(page).toHaveTitle(/Flow Day Planner/);
  await expect(page.getByRole("heading", { name: "Flow Day Planner" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  await expect(page.getByText("Mot de passe oublié ?")).toBeVisible();
});

test("protected route redirects an anonymous visitor to auth", async ({ page }) => {
  await page.goto("/today");
  await page.waitForURL(/\/auth$/);
  await expect(page.getByRole("heading", { name: "Flow Day Planner" })).toBeVisible();
});

test("invalid password recovery link fails safely", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { name: "Nouveau mot de passe" })).toBeVisible();
  await expect(page.getByText(/invalide ou expiré/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Retour à la connexion" })).toBeVisible();
});

test("PWA manifest exposes the final application identity", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.name).toBe("Flow Day Planner");
  expect(manifest.short_name).toBe("Flow Day");
  expect(manifest.display).toBe("standalone");
});

test("root service worker registers and contains the background push reminder path", async ({
  page,
  request,
}) => {
  await page.goto("/auth");

  const worker = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return null;
    const created = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const registration = await navigator.serviceWorker.ready;
    return {
      scope: registration.scope,
      scriptURL: registration.active?.scriptURL ?? created.active?.scriptURL ?? null,
    };
  });

  expect(worker?.scriptURL).toMatch(/\/sw\.js$/);
  expect(worker?.scope).toMatch(/\/$/);

  const response = await request.get("/sw.js");
  expect(response.ok()).toBeTruthy();
  const source = await response.text();
  expect(source).toContain('addEventListener("push"');
  expect(source).toContain("showNotification");
  expect(source).toContain("requireInteraction");
  expect(source).toContain("vibrate");
});
