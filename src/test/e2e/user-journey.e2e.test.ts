import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import { createServer } from '../../api/server';
import { PrismaClient } from '@prisma/client';

describe('User Journey E2E Tests', () => {
  let driver: WebDriver;
  let server: any;
  let prisma: PrismaClient;

  beforeAll(async () => {
    server = await createServer();
    server.listen(3000);
    prisma = new PrismaClient();

    driver = await new Builder()
      .forBrowser('chrome')
      .build();
  });

  afterAll(async () => {
    await driver.quit();
    await server.close();
    await prisma.$disconnect();
  });

  describe('User Registration and Login Flow', () => {
    it('should successfully register a new user', async () => {
      await driver.get('http://localhost:3000/register');

      await driver.findElement(By.name('email')).sendKeys('test@example.com');
      await driver.findElement(By.name('password')).sendKeys('TestPassword123!');
      await driver.findElement(By.name('name')).sendKeys('Test User');
      
      await driver.findElement(By.css('button[type="submit"]')).click();

      const successMessage = await driver.wait(
        until.elementLocated(By.css('.success-message')),
        5000
      );

      expect(await successMessage.getText()).toContain('Registration successful');
    });

    it('should successfully login and access terminal', async () => {
      await driver.get('http://localhost:3000/login');

      await driver.findElement(By.name('email')).sendKeys('test@example.com');
      await driver.findElement(By.name('password')).sendKeys('TestPassword123!');
      
      await driver.findElement(By.css('button[type="submit"]')).click();

      const terminal = await driver.wait(
        until.elementLocated(By.css('.terminal-container')),
        5000
      );

      expect(await terminal.isDisplayed()).toBe(true);
    });
  });

  describe('Terminal Usage Flow', () => {
    it('should execute commands and display output', async () => {
      await driver.get('http://localhost:3000/terminal');

      const terminalInput = await driver.findElement(By.css('.terminal-input'));
      await terminalInput.sendKeys('echo "Hello World"\\n');

      const output = await driver.wait(
        until.elementLocated(By.css('.terminal-output')),
        5000
      );

      expect(await output.getText()).toContain('Hello World');
    });

    it('should show command suggestions', async () => {
      const terminalInput = await driver.findElement(By.css('.terminal-input'));
      await terminalInput.sendKeys('git');

      const suggestions = await driver.wait(
        until.elementsLocated(By.css('.suggestion-item')),
        5000
      );

      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Profile Management Flow', () => {
    it('should update user profile', async () => {
      await driver.get('http://localhost:3000/profile');

      await driver.findElement(By.name('name')).clear();
      await driver.findElement(By.name('name')).sendKeys('Updated Name');
      
      await driver.findElement(By.css('button[type="submit"]')).click();

      const successMessage = await driver.wait(
        until.elementLocated(By.css('.success-message')),
        5000
      );

      expect(await successMessage.getText()).toContain('Profile updated');
    });
  });

  describe('Subscription Flow', () => {
    it('should subscribe to pro plan', async () => {
      await driver.get('http://localhost:3000/subscription');

      await driver.findElement(By.css('[data-plan="pro"]')).click();
      
      // Fill in stripe payment form
      const stripeFrame = await driver.wait(
        until.elementLocated(By.css('iframe[name^="__privateStripeFrame"]')),
        5000
      );
      await driver.switchTo().frame(stripeFrame);

      await driver.findElement(By.name('cardnumber')).sendKeys('4242424242424242');
      await driver.findElement(By.name('exp-date')).sendKeys('1225');
      await driver.findElement(By.name('cvc')).sendKeys('123');
      await driver.findElement(By.name('postal')).sendKeys('12345');

      await driver.switchTo().defaultContent();
      await driver.findElement(By.css('button[type="submit"]')).click();

      const successMessage = await driver.wait(
        until.elementLocated(By.css('.success-message')),
        10000
      );

      expect(await successMessage.getText()).toContain('Subscription activated');
    });
  });
});
