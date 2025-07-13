function isDevelopment() {
  const extensionId = chrome.runtime.id;
  const productionId = "hiihidgnikjcoknakdkijkfbebncgbki";
  console.log("Extension ID:", extensionId);
  return extensionId !== productionId;
}

function getApiUrl() {
  console.log("isDevelopment:", isDevelopment());
  return isDevelopment()
    ? "http://localhost:3000/summarize"
    : "http://170.64.173.95/summarize";
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Popup loaded");

  const summaryDiv = document.getElementById("summary");
  const loadingText = document.getElementById("loading");
  const longSummarizeButton = document.getElementById("long-summarize");
  const shortSummarizeButton = document.getElementById("short-summarize");
  const coffeeDiv = document.getElementById("coffee");

  coffeeDiv.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://buymeacoffee.com/doggoreader" });
  });

  // Load persisted summary on popup load
  chrome.storage.local.get("summary", (result) => {
    if (result && result.summary) {
      summaryDiv.innerHTML = result.summary; // Display saved summary
      console.log("Loaded summary from storage:", result.summary);
    } else {
      console.log("No summary found in storage.");
    }
  });

  // Summarize button click handler

  const summarize = async (length) => {
    console.log("Summarize button clicked!");
    summaryDiv.textContent = "";
    loadingText.style.display = "block";

    // Get the current tab's content
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];

      // Add check for chrome:// URLs
      if (tab.url.startsWith("chrome://")) {
        summaryDiv.textContent =
          "Cannot summarize Chrome internal / empty pages.";
        loadingText.style.display = "none";
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: () => document.body.innerText,
        },
        async (results) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error executing script:",
              chrome.runtime.lastError.message
            );
            summaryDiv.textContent = "Failed to extract page content.";
            loadingText.style.display = "none";
            return;
          }

          if (results && results[0] && results[0].result) {
            console.log("Results:", results);
            const pageText = results[0].result;
            console.log("Page text:", pageText);
            const summaryPrompt = `${pageText}`;

            try {
              // Use HTTP for now
              const response = await fetch(getApiUrl(), {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  pageText: summaryPrompt,
                  length,
                }),
              });

              if (response.status === 429) {
                summaryDiv.textContent =
                  "Too many requests. Please wait a moment and try again. ☹️";
                loadingText.style.display = "none";
                return;
              }

              // Add this to see the origin in your console
              console.log("Request origin:", chrome.runtime.getURL(""));

              if (!response.ok)
                throw new Error(`API error: ${response.statusText}`);

              const summary = await response.json();

              // Display summary in the popup
              // summaryDiv.textContent = summary;
              // Display the HTML directly in the summary div
              summaryDiv.innerHTML = summary;

              // Persist the summary to local storage
              chrome.storage.local.set({ summary }, () => {
                console.log("Summary saved to local storage:", summary);
              });
            } catch (error) {
              console.error("Error fetching summary:", error.message);
              summaryDiv.textContent =
                "Failed to fetch summary. Please try again.";
            } finally {
              loadingText.style.display = "none";
            }
          } else {
            summaryDiv.textContent = "Failed to extract page content.";
            loadingText.style.display = "none";
          }
        }
      );
    });
  };

  longSummarizeButton.addEventListener("click", () => summarize("long"));
  shortSummarizeButton.addEventListener("click", () => summarize("short"));
});
