// src/index.ts

import readline from "readline";
import { parseTradeCommand } from "./agents/gmx/prompts/main";
import { placeTrade } from "./agents/gmx/actions/index";

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (query: string): Promise<string> =>
    new Promise((resolve) => {
      rl.question(query, (answer) => resolve(answer));
    });

  try {
    console.log("GMX Trading Agent is launching...");

    while (true) {
      const input = await askQuestion(
        "\nEnter your trading command (or 'exit' to quit): "
      );
      if (input.toLowerCase() === "exit") {
        console.log("Exiting trading agent...");
        break;
      }

      console.log("\nProcessing your command...");
      const order = await parseTradeCommand(input);

      console.log("\nParsed trade parameters:");
      console.log("Token In:", order.tokenIn);
      console.log("Token Out:", order.tokenOut);
      console.log("Amount In:", order.amountIn);
      console.log("Minimum Out:", order.minOut);

      const proceed = await askQuestion("\nProceed with trade? (yes/no): ");
      if (proceed.toLowerCase() === "yes") {
        console.log("\nExecuting trade...");
        const tx = await placeTrade(order);
        console.log("Trade executed successfully:", tx);
      } else {
        console.log("Trade cancelled.");
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
