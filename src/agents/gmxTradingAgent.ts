import { createDreams, cli } from "@daydreamsai/core/v1";
import { getGMXPrice } from "../utils/gmxContracts";

console.log("GMX Trading Agent is launching...");

// Using a dummy model object to bypass the type error.
// This is a temporary workaround until you're ready to integrate a real language model.
const dummyModel = { name: "dummy-model" } as any;

const agent = createDreams({
  model: dummyModel,
  extensions: [cli],
});

agent
  .start()
  .then(async () => {
    console.log("Agent started successfully.");

    try {
      const price = await getGMXPrice();
      console.log("Current GMX Market Price:", price);
    } catch (error) {
      console.error("Error fetching GMX price:", error);
    }
  })
  .catch((error) => {
    console.error("Failed to start GMX Trading Agent:", error);
  });
