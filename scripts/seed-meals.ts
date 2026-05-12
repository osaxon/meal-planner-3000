/**
 * Seed the meal pool for the first user in the database.
 *
 * Usage:
 *   vp run seed
 *
 * The script is idempotent — re-running it skips meals that already exist
 * (matched by name) and skips categories that already exist (matched by name).
 * Ingredients are always re-created for existing meals that have none.
 */

import { config } from "dotenv";
import { eq, and, count } from "drizzle-orm";
import { createDatabase } from "#/db/factory";
import { user, categories, meals, mealIngredients } from "#/db/schema";

config({ path: [".env.local", ".env"] });

const db = createDatabase(process.env["DATABASE_URL"]!);

// ── Types ─────────────────────────────────────────────────────────────────────

type Diet = "meat" | "fish" | "vegetarian";
type Season = "year_round" | "spring_summer" | "autumn_winter" | "festive" | "bbq";
type Ingredient = { name: string; quantity?: number; unit?: string };

type MealSeed = {
  name: string;
  category: string;
  diet: Diet;
  season: Season;
  producesLeftovers: boolean;
  ingredients: Ingredient[];
};

// ── Categories ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Pasta",
  "Curry",
  "Soup",
  "Salad",
  "Stir-fry",
  "Roast",
  "Pie & Bake",
  "Grilled & BBQ",
];

// ── Meals with ingredients ────────────────────────────────────────────────────

const MEALS: MealSeed[] = [
  // ── Pasta ─────────────────────────────────────────────────────────────────
  {
    name: "Spaghetti Bolognese",
    category: "Pasta",
    diet: "meat",
    season: "year_round",
    producesLeftovers: true,
    ingredients: [
      { name: "Beef mince", quantity: 500, unit: "g" },
      { name: "Spaghetti", quantity: 400, unit: "g" },
      { name: "Tinned tomatoes", quantity: 2, unit: "tins" },
      { name: "Onion", quantity: 1 },
      { name: "Garlic", quantity: 3, unit: "cloves" },
    ],
  },
  {
    name: "Carbonara",
    category: "Pasta",
    diet: "meat",
    season: "year_round",
    producesLeftovers: false,
    ingredients: [
      { name: "Spaghetti", quantity: 300, unit: "g" },
      { name: "Pancetta", quantity: 150, unit: "g" },
      { name: "Eggs", quantity: 4 },
      { name: "Parmesan", quantity: 80, unit: "g" },
    ],
  },
  {
    name: "Chicken Pesto Pasta",
    category: "Pasta",
    diet: "meat",
    season: "spring_summer",
    producesLeftovers: false,
    ingredients: [
      { name: "Chicken breast", quantity: 2 },
      { name: "Pasta", quantity: 300, unit: "g" },
      { name: "Pesto", quantity: 4, unit: "tbsp" },
      { name: "Cherry tomatoes", quantity: 200, unit: "g" },
    ],
  },
  {
    name: "Pasta Arrabiata",
    category: "Pasta",
    diet: "vegetarian",
    season: "year_round",
    producesLeftovers: false,
    ingredients: [
      { name: "Penne", quantity: 300, unit: "g" },
      { name: "Tinned tomatoes", quantity: 1, unit: "tin" },
      { name: "Garlic", quantity: 4, unit: "cloves" },
      { name: "Chilli flakes", quantity: 1, unit: "tsp" },
    ],
  },
  {
    name: "Tuna Pasta Bake",
    category: "Pasta",
    diet: "fish",
    season: "year_round",
    producesLeftovers: true,
    ingredients: [
      { name: "Pasta", quantity: 400, unit: "g" },
      { name: "Tinned tuna", quantity: 2, unit: "tins" },
      { name: "Tinned tomatoes", quantity: 1, unit: "tin" },
      { name: "Cheddar", quantity: 100, unit: "g" },
      { name: "Onion", quantity: 1 },
    ],
  },
  {
    name: "Vegetable Lasagne",
    category: "Pasta",
    diet: "vegetarian",
    season: "year_round",
    producesLeftovers: true,
    ingredients: [
      { name: "Lasagne sheets", quantity: 12 },
      { name: "Courgette", quantity: 2 },
      { name: "Aubergine", quantity: 1 },
      { name: "Tinned tomatoes", quantity: 2, unit: "tins" },
      { name: "Ricotta", quantity: 250, unit: "g" },
      { name: "Mozzarella", quantity: 125, unit: "g" },
    ],
  },
  {
    name: "Crab Linguine",
    category: "Pasta",
    diet: "fish",
    season: "spring_summer",
    producesLeftovers: false,
    ingredients: [
      { name: "Linguine", quantity: 300, unit: "g" },
      { name: "White crab meat", quantity: 200, unit: "g" },
      { name: "Chilli", quantity: 1 },
      { name: "Garlic", quantity: 2, unit: "cloves" },
      { name: "Lemon", quantity: 1 },
    ],
  },
  {
    name: "Sausage & Fennel Pasta",
    category: "Pasta",
    diet: "meat",
    season: "autumn_winter",
    producesLeftovers: false,
    ingredients: [
      { name: "Italian sausages", quantity: 6 },
      { name: "Rigatoni", quantity: 300, unit: "g" },
      { name: "Fennel", quantity: 1 },
      { name: "Tinned tomatoes", quantity: 1, unit: "tin" },
    ],
  },

  // ── Curry ─────────────────────────────────────────────────────────────────
  {
    name: "Chicken Tikka Masala",
    category: "Curry",
    diet: "meat",
    season: "year_round",
    producesLeftovers: true,
    ingredients: [
      { name: "Chicken breast", quantity: 600, unit: "g" },
      { name: "Tikka masala paste", quantity: 4, unit: "tbsp" },
      { name: "Tinned tomatoes", quantity: 1, unit: "tin" },
      { name: "Double cream", quantity: 150, unit: "ml" },
      { name: "Onion", quantity: 1 },
      { name: "Rice", quantity: 300, unit: "g" },
    ],
  },
  {
    name: "Thai Green Curry",
    category: "Curry",
    diet: "meat",
    season: "year_round",
    producesLeftovers: false,
    ingredients: [
      { name: "Chicken thigh", quantity: 500, unit: "g" },
      { name: "Thai green curry paste", quantity: 3, unit: "tbsp" },
      { name: "Coconut milk", quantity: 400, unit: "ml" },
      { name: "Green beans", quantity: 150, unit: "g" },
      { name: "Rice", quantity: 300, unit: "g" },
    ],
  },
  {
    name: "Lamb Rogan Josh",
    category: "Curry",
    diet: "meat",
    season: "autumn_winter",
    producesLeftovers: true,
    ingredients: [
      { name: "Lamb shoulder", quantity: 800, unit: "g" },
      { name: "Rogan josh paste", quantity: 4, unit: "tbsp" },
      { name: "Tinned tomatoes", quantity: 1, unit: "tin" },
      { name: "Onion", quantity: 2 },
      { name: "Rice", quantity: 300, unit: "g" },
    ],
  },
  {
    name: "Chickpea & Spinach Dhal",
    category: "Curry",
    diet: "vegetarian",
    season: "year_round",
    producesLeftovers: true,
    ingredients: [
      { name: "Red lentils", quantity: 250, unit: "g" },
      { name: "Tinned chickpeas", quantity: 1, unit: "tin" },
      { name: "Spinach", quantity: 100, unit: "g" },
      { name: "Tinned tomatoes", quantity: 1, unit: "tin" },
      { name: "Onion", quantity: 1 },
      { name: "Garlic", quantity: 3, unit: "cloves" },
    ],
  },
  {
    name: "Prawn Madras",
    category: "Curry",
    diet: "fish",
    season: "year_round",
    producesLeftovers: false,
    ingredients: [
      { name: "Raw king prawns", quantity: 400, unit: "g" },
      { name: "Madras paste", quantity: 3, unit: "tbsp" },
      { name: "Tinned tomatoes", quantity: 1, unit: "tin" },
      { name: "Coconut milk", quantity: 200, unit: "ml" },
      { name: "Rice", quantity: 300, unit: "g" },
    ],
  },
  {
    name: "Butter Chicken",
    category: "Curry",
    diet: "meat",
    season: "year_round",
    producesLeftovers: true,
    ingredients: [
      { name: "Chicken breast", quantity: 600, unit: "g" },
      { name: "Butter chicken sauce", quantity: 1, unit: "jar" },
      { name: "Double cream", quantity: 100, unit: "ml" },
      { name: "Rice", quantity: 300, unit: "g" },
    ],
  },
  {
    name: "King Prawn Jalfrezi",
    category: "Curry",
    diet: "fish",
    season: "year_round",
    producesLeftovers: false,
    ingredients: [
      { name: "Raw king prawns", quantity: 400, unit: "g" },
      { name: "Jalfrezi paste", quantity: 3, unit: "tbsp" },
      { name: "Mixed peppers", quantity: 2 },
      { name: "Tinned tomatoes", quantity: 1, unit: "tin" },
      { name: "Rice", quantity: 300, unit: "g" },
    ],
  },
  {
    name: "Aubergine & Lentil Curry",
    category: "Curry",
    diet: "vegetarian",
    season: "autumn_winter",
    producesLeftovers: true,
    ingredients: [
      { name: "Aubergine", quantity: 2 },
      { name: "Red lentils", quantity: 200, unit: "g" },
      { name: "Tinned tomatoes", quantity: 1, unit: "tin" },
      { name: "Coconut milk", quantity: 400, unit: "ml" },
      { name: "Onion", quantity: 1 },
    ],
  },

  // ── Soup ──────────────────────────────────────────────────────────────────
  {
    name: "Tomato & Basil Soup",
    category: "Soup",
    diet: "vegetarian",
    season: "spring_summer",
    producesLeftovers: true,
    ingredients: [
      { name: "Tinned tomatoes", quantity: 3, unit: "tins" },
      { name: "Vegetable stock", quantity: 500, unit: "ml" },
      { name: "Fresh basil", quantity: 1, unit: "bunch" },
      { name: "Onion", quantity: 1 },
      { name: "Garlic", quantity: 2, unit: "cloves" },
    ],
  },
  {
    name: "Leek & Potato Soup",
    category: "Soup",
    diet: "vegetarian",
    season: "autumn_winter",
    producesLeftovers: true,
    ingredients: [
      { name: "Leeks", quantity: 3 },
      { name: "Potatoes", quantity: 500, unit: "g" },
      { name: "Vegetable stock", quantity: 1, unit: "litre" },
      { name: "Butter", quantity: 50, unit: "g" },
    ],
  },
  {
    name: "Chicken Noodle Soup",
    category: "Soup",
    diet: "meat",
    season: "autumn_winter",
    producesLeftovers: false,
    ingredients: [
      { name: "Chicken thigh", quantity: 4 },
      { name: "Egg noodles", quantity: 150, unit: "g" },
      { name: "Chicken stock", quantity: 1.5, unit: "litres" },
      { name: "Carrots", quantity: 2 },
      { name: "Celery", quantity: 3, unit: "sticks" },
    ],
  },
  {
    name: "French Onion Soup",
    category: "Soup",
    diet: "vegetarian",
    season: "autumn_winter",
    producesLeftovers: false,
    ingredients: [
      { name: "Onion", quantity: 6 },
      { name: "Beef stock", quantity: 1, unit: "litre" },
      { name: "Baguette", quantity: 1 },
      { name: "Gruyère", quantity: 150, unit: "g" },
      { name: "Butter", quantity: 50, unit: "g" },
    ],
  },
  {
    name: "Pea & Ham Soup",
    category: "Soup",
    diet: "meat",
    season: "spring_summer",
    producesLeftovers: true,
    ingredients: [
      { name: "Frozen peas", quantity: 500, unit: "g" },
      { name: "Ham hock", quantity: 1 },
      { name: "Chicken stock", quantity: 1, unit: "litre" },
      { name: "Onion", quantity: 1 },
      { name: "Mint", quantity: 1, unit: "bunch" },
    ],
  },
  {
    name: "Spiced Butternut Squash Soup",
    category: "Soup",
    diet: "vegetarian",
    season: "autumn_winter",
    producesLeftovers: true,
    ingredients: [
      { name: "Butternut squash", quantity: 1 },
      { name: "Vegetable stock", quantity: 800, unit: "ml" },
      { name: "Coconut milk", quantity: 200, unit: "ml" },
      { name: "Onion", quantity: 1 },
      { name: "Garlic", quantity: 2, unit: "cloves" },
    ],
  },

  // ── Salad ─────────────────────────────────────────────────────────────────
  {
    name: "Caesar Salad",
    category: "Salad",
    diet: "meat",
    season: "spring_summer",
    producesLeftovers: false,
    ingredients: [
      { name: "Chicken breast", quantity: 2 },
      { name: "Romaine lettuce", quantity: 1 },
      { name: "Caesar dressing", quantity: 1, unit: "bottle" },
      { name: "Parmesan", quantity: 50, unit: "g" },
      { name: "Croutons", quantity: 1, unit: "bag" },
    ],
  },
  {
    name: "Niçoise Salad",
    category: "Salad",
    diet: "fish",
    season: "spring_summer",
    producesLeftovers: false,
    ingredients: [
      { name: "Tinned tuna", quantity: 2, unit: "tins" },
      { name: "Eggs", quantity: 4 },
      { name: "Green beans", quantity: 150, unit: "g" },
      { name: "Black olives", quantity: 80, unit: "g" },
      { name: "Cherry tomatoes", quantity: 200, unit: "g" },
    ],
  },
  {
    name: "Greek Salad",
    category: "Salad",
    diet: "vegetarian",
    season: "spring_summer",
    producesLeftovers: false,
    ingredients: [
      { name: "Feta", quantity: 200, unit: "g" },
      { name: "Cucumber", quantity: 1 },
      { name: "Tomatoes", quantity: 4 },
      { name: "Red onion", quantity: 1 },
      { name: "Kalamata olives", quantity: 80, unit: "g" },
    ],
  },
  {
    name: "Chicken & Avocado Salad",
    category: "Salad",
    diet: "meat",
    season: "spring_summer",
    producesLeftovers: false,
    ingredients: [
      { name: "Chicken breast", quantity: 2 },
      { name: "Avocado", quantity: 2 },
      { name: "Mixed leaves", quantity: 1, unit: "bag" },
      { name: "Cherry tomatoes", quantity: 150, unit: "g" },
      { name: "Lemon", quantity: 1 },
    ],
  },
  {
    name: "Smoked Salmon & Dill Salad",
    category: "Salad",
    diet: "fish",
    season: "spring_summer",
    producesLeftovers: false,
    ingredients: [
      { name: "Smoked salmon", quantity: 200, unit: "g" },
      { name: "Mixed leaves", quantity: 1, unit: "bag" },
      { name: "Cucumber", quantity: 1 },
      { name: "Cream cheese", quantity: 100, unit: "g" },
      { name: "Fresh dill", quantity: 1, unit: "bunch" },
    ],
  },
  {
    name: "Halloumi & Roasted Veg Salad",
    category: "Salad",
    diet: "vegetarian",
    season: "spring_summer",
    producesLeftovers: false,
    ingredients: [
      { name: "Halloumi", quantity: 250, unit: "g" },
      { name: "Courgette", quantity: 2 },
      { name: "Red pepper", quantity: 2 },
      { name: "Mixed leaves", quantity: 1, unit: "bag" },
    ],
  },

  // ── Stir-fry ──────────────────────────────────────────────────────────────
  {
    name: "Beef & Broccoli Stir-fry",
    category: "Stir-fry",
    diet: "meat",
    season: "year_round",
    producesLeftovers: false,
    ingredients: [
      { name: "Beef sirloin", quantity: 400, unit: "g" },
      { name: "Broccoli", quantity: 300, unit: "g" },
      { name: "Oyster sauce", quantity: 3, unit: "tbsp" },
      { name: "Soy sauce", quantity: 2, unit: "tbsp" },
      { name: "Rice", quantity: 300, unit: "g" },
    ],
  },
  {
    name: "Chicken Chow Mein",
    category: "Stir-fry",
    diet: "meat",
    season: "year_round",
    producesLeftovers: false,
    ingredients: [
      { name: "Chicken breast", quantity: 400, unit: "g" },
      { name: "Egg noodles", quantity: 300, unit: "g" },
      { name: "Beansprouts", quantity: 150, unit: "g" },
      { name: "Soy sauce", quantity: 3, unit: "tbsp" },
      { name: "Mixed peppers", quantity: 2 },
    ],
  },
  {
    name: "King Prawn & Bok Choy Stir-fry",
    category: "Stir-fry",
    diet: "fish",
    season: "year_round",
    producesLeftovers: false,
    ingredients: [
      { name: "Raw king prawns", quantity: 400, unit: "g" },
      { name: "Bok choy", quantity: 3 },
      { name: "Garlic", quantity: 3, unit: "cloves" },
      { name: "Soy sauce", quantity: 2, unit: "tbsp" },
      { name: "Rice", quantity: 300, unit: "g" },
    ],
  },
  {
    name: "Tofu & Vegetable Stir-fry",
    category: "Stir-fry",
    diet: "vegetarian",
    season: "year_round",
    producesLeftovers: false,
    ingredients: [
      { name: "Firm tofu", quantity: 400, unit: "g" },
      { name: "Mixed vegetables", quantity: 400, unit: "g" },
      { name: "Soy sauce", quantity: 3, unit: "tbsp" },
      { name: "Sesame oil", quantity: 1, unit: "tbsp" },
      { name: "Rice", quantity: 300, unit: "g" },
    ],
  },
  {
    name: "Pad Thai",
    category: "Stir-fry",
    diet: "meat",
    season: "year_round",
    producesLeftovers: false,
    ingredients: [
      { name: "Rice noodles", quantity: 250, unit: "g" },
      { name: "Chicken breast", quantity: 300, unit: "g" },
      { name: "Eggs", quantity: 2 },
      { name: "Beansprouts", quantity: 150, unit: "g" },
      { name: "Pad Thai sauce", quantity: 4, unit: "tbsp" },
    ],
  },

  // ── Roast ─────────────────────────────────────────────────────────────────
  {
    name: "Roast Chicken",
    category: "Roast",
    diet: "meat",
    season: "autumn_winter",
    producesLeftovers: true,
    ingredients: [
      { name: "Whole chicken", quantity: 1.8, unit: "kg" },
      { name: "Potatoes", quantity: 1, unit: "kg" },
      { name: "Carrots", quantity: 4 },
      { name: "Onion", quantity: 2 },
      { name: "Butter", quantity: 50, unit: "g" },
    ],
  },
  {
    name: "Roast Leg of Lamb",
    category: "Roast",
    diet: "meat",
    season: "festive",
    producesLeftovers: true,
    ingredients: [
      { name: "Leg of lamb", quantity: 2, unit: "kg" },
      { name: "Garlic", quantity: 6, unit: "cloves" },
      { name: "Rosemary", quantity: 1, unit: "bunch" },
      { name: "Potatoes", quantity: 1, unit: "kg" },
    ],
  },
  {
    name: "Slow-roasted Pork Shoulder",
    category: "Roast",
    diet: "meat",
    season: "autumn_winter",
    producesLeftovers: true,
    ingredients: [
      { name: "Pork shoulder", quantity: 2, unit: "kg" },
      { name: "Apple cider", quantity: 300, unit: "ml" },
      { name: "Onion", quantity: 2 },
      { name: "Potatoes", quantity: 1, unit: "kg" },
    ],
  },
  {
    name: "Nut Roast",
    category: "Roast",
    diet: "vegetarian",
    season: "festive",
    producesLeftovers: false,
    ingredients: [
      { name: "Mixed nuts", quantity: 300, unit: "g" },
      { name: "Breadcrumbs", quantity: 100, unit: "g" },
      { name: "Onion", quantity: 1 },
      { name: "Eggs", quantity: 2 },
      { name: "Mushrooms", quantity: 200, unit: "g" },
    ],
  },
  {
    name: "Roast Salmon with Lemon & Dill",
    category: "Roast",
    diet: "fish",
    season: "spring_summer",
    producesLeftovers: false,
    ingredients: [
      { name: "Salmon fillet", quantity: 4 },
      { name: "Lemon", quantity: 2 },
      { name: "Fresh dill", quantity: 1, unit: "bunch" },
      { name: "New potatoes", quantity: 600, unit: "g" },
    ],
  },

  // ── Pie & Bake ────────────────────────────────────────────────────────────
  {
    name: "Shepherd's Pie",
    category: "Pie & Bake",
    diet: "meat",
    season: "autumn_winter",
    producesLeftovers: true,
    ingredients: [
      { name: "Lamb mince", quantity: 500, unit: "g" },
      { name: "Potatoes", quantity: 900, unit: "g" },
      { name: "Carrots", quantity: 2 },
      { name: "Onion", quantity: 1 },
      { name: "Lamb stock", quantity: 300, unit: "ml" },
    ],
  },
  {
    name: "Fish Pie",
    category: "Pie & Bake",
    diet: "fish",
    season: "autumn_winter",
    producesLeftovers: true,
    ingredients: [
      { name: "Salmon fillet", quantity: 300, unit: "g" },
      { name: "Smoked haddock", quantity: 300, unit: "g" },
      { name: "Raw king prawns", quantity: 200, unit: "g" },
      { name: "Potatoes", quantity: 900, unit: "g" },
      { name: "Milk", quantity: 500, unit: "ml" },
    ],
  },
  {
    name: "Chicken & Leek Pie",
    category: "Pie & Bake",
    diet: "meat",
    season: "autumn_winter",
    producesLeftovers: true,
    ingredients: [
      { name: "Chicken thigh", quantity: 600, unit: "g" },
      { name: "Leeks", quantity: 3 },
      { name: "Puff pastry", quantity: 320, unit: "g" },
      { name: "Double cream", quantity: 200, unit: "ml" },
    ],
  },
  {
    name: "Moussaka",
    category: "Pie & Bake",
    diet: "meat",
    season: "autumn_winter",
    producesLeftovers: true,
    ingredients: [
      { name: "Lamb mince", quantity: 500, unit: "g" },
      { name: "Aubergine", quantity: 3 },
      { name: "Tinned tomatoes", quantity: 1, unit: "tin" },
      { name: "Milk", quantity: 500, unit: "ml" },
      { name: "Parmesan", quantity: 60, unit: "g" },
    ],
  },
  {
    name: "Spanakopita",
    category: "Pie & Bake",
    diet: "vegetarian",
    season: "spring_summer",
    producesLeftovers: false,
    ingredients: [
      { name: "Spinach", quantity: 500, unit: "g" },
      { name: "Feta", quantity: 300, unit: "g" },
      { name: "Filo pastry", quantity: 270, unit: "g" },
      { name: "Eggs", quantity: 3 },
      { name: "Onion", quantity: 2 },
    ],
  },
  {
    name: "Smoked Haddock Fishcakes",
    category: "Pie & Bake",
    diet: "fish",
    season: "year_round",
    producesLeftovers: false,
    ingredients: [
      { name: "Smoked haddock", quantity: 400, unit: "g" },
      { name: "Potatoes", quantity: 500, unit: "g" },
      { name: "Eggs", quantity: 2 },
      { name: "Breadcrumbs", quantity: 100, unit: "g" },
    ],
  },

  // ── Grilled & BBQ ─────────────────────────────────────────────────────────
  {
    name: "BBQ Ribs",
    category: "Grilled & BBQ",
    diet: "meat",
    season: "bbq",
    producesLeftovers: true,
    ingredients: [
      { name: "Pork ribs", quantity: 1.5, unit: "kg" },
      { name: "BBQ sauce", quantity: 1, unit: "bottle" },
      { name: "Garlic", quantity: 4, unit: "cloves" },
    ],
  },
  {
    name: "Grilled Sea Bass",
    category: "Grilled & BBQ",
    diet: "fish",
    season: "spring_summer",
    producesLeftovers: false,
    ingredients: [
      { name: "Sea bass fillets", quantity: 4 },
      { name: "Lemon", quantity: 2 },
      { name: "Garlic", quantity: 2, unit: "cloves" },
      { name: "Fresh herbs", quantity: 1, unit: "bunch" },
    ],
  },
  {
    name: "Chicken Souvlaki",
    category: "Grilled & BBQ",
    diet: "meat",
    season: "bbq",
    producesLeftovers: false,
    ingredients: [
      { name: "Chicken thigh", quantity: 600, unit: "g" },
      { name: "Pitta bread", quantity: 4 },
      { name: "Tzatziki", quantity: 1, unit: "tub" },
      { name: "Lemon", quantity: 1 },
      { name: "Garlic", quantity: 3, unit: "cloves" },
    ],
  },
  {
    name: "Halloumi & Veg Skewers",
    category: "Grilled & BBQ",
    diet: "vegetarian",
    season: "bbq",
    producesLeftovers: false,
    ingredients: [
      { name: "Halloumi", quantity: 500, unit: "g" },
      { name: "Courgette", quantity: 2 },
      { name: "Red pepper", quantity: 2 },
      { name: "Red onion", quantity: 2 },
    ],
  },
  {
    name: "Grilled Tuna Steak",
    category: "Grilled & BBQ",
    diet: "fish",
    season: "spring_summer",
    producesLeftovers: false,
    ingredients: [
      { name: "Tuna steaks", quantity: 4 },
      { name: "Soy sauce", quantity: 3, unit: "tbsp" },
      { name: "Sesame oil", quantity: 1, unit: "tbsp" },
      { name: "Lemon", quantity: 1 },
    ],
  },
  {
    name: "Lamb Kofta",
    category: "Grilled & BBQ",
    diet: "meat",
    season: "bbq",
    producesLeftovers: false,
    ingredients: [
      { name: "Lamb mince", quantity: 500, unit: "g" },
      { name: "Onion", quantity: 1 },
      { name: "Garlic", quantity: 3, unit: "cloves" },
      { name: "Pitta bread", quantity: 4 },
      { name: "Tzatziki", quantity: 1, unit: "tub" },
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const [firstUser] = await db.select().from(user).limit(1);
  if (!firstUser) {
    console.error("No users found. Sign up first, then re-run this script.");
    process.exit(1);
  }
  console.log(`Seeding for user: ${firstUser.email} (${firstUser.id})\n`);

  // Upsert categories
  const categoryIdByName = new Map<string, number>();
  for (const name of CATEGORIES) {
    const [existing] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, firstUser.id), eq(categories.name, name)));

    if (existing) {
      categoryIdByName.set(name, existing.id);
    } else {
      const [created] = await db
        .insert(categories)
        .values({ userId: firstUser.id, name })
        .returning();
      categoryIdByName.set(name, created!.id);
      console.log(`  + category: ${name}`);
    }
  }

  // Upsert meals and their ingredients
  let mealsCreated = 0;
  let mealsSkipped = 0;
  let ingredientsAdded = 0;

  for (const seed of MEALS) {
    const categoryId = categoryIdByName.get(seed.category);
    if (!categoryId) {
      console.warn(`  ⚠ unknown category "${seed.category}", skipping ${seed.name}`);
      continue;
    }

    let mealId: number;

    const [existing] = await db
      .select()
      .from(meals)
      .where(and(eq(meals.userId, firstUser.id), eq(meals.name, seed.name)));

    if (existing) {
      mealId = existing.id;
      mealsSkipped++;
    } else {
      const [created] = await db
        .insert(meals)
        .values({
          userId: firstUser.id,
          name: seed.name,
          categoryId,
          diet: seed.diet,
          season: seed.season,
          producesLeftovers: seed.producesLeftovers,
        })
        .returning();
      mealId = created!.id;
      mealsCreated++;
    }

    // Add ingredients if the meal has none yet
    const [{ ingredientCount }] = await db
      .select({ ingredientCount: count() })
      .from(mealIngredients)
      .where(eq(mealIngredients.mealId, mealId));

    if (ingredientCount === 0 && seed.ingredients.length > 0) {
      await db.insert(mealIngredients).values(
        seed.ingredients.map((ing) => ({
          mealId,
          name: ing.name,
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
        })),
      );
      ingredientsAdded += seed.ingredients.length;
    }
  }

  console.log(
    `\nDone. ${mealsCreated} meals created, ${mealsSkipped} already existed, ${ingredientsAdded} ingredients added.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
