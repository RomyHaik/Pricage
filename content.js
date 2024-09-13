let selectedElement = null;
let detectedPrices = [];

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "selectElement") {
    startElementSelection();
  } else if (request.action === "analyzePrices") {
    analyzePrices();
  } else if (request.action === "jumpTo") {
    jumpToPrice(request.index);
  }
});

function startElementSelection() {
  document.body.style.cursor = 'crosshair';
  document.addEventListener('click', selectElement, {once: true});
}

function selectElement(e) {
  e.preventDefault();
  selectedElement = e.target;
  document.body.style.cursor = 'default';
  calculateAverageForSelected();
}

function calculateAverageForSelected() {
  if (!selectedElement) return;

  const tagName = selectedElement.tagName;
  const className = selectedElement.className;
  const similarElements = document.querySelectorAll(`${tagName}.${className}`);
  
  detectedPrices = extractPrices(similarElements);
  sendResult(detectedPrices);
}

function analyzePrices() {
  const priceElements = document.querySelectorAll('[class*="price"], [class*="cost"], [class*="amount"], [itemprop="price"]');
  detectedPrices = extractPrices(priceElements);
  sendResult(detectedPrices);
}

function extractPrices(elements) {
  let prices = [];

  elements.forEach((element) => {
    if (!isInMainContent(element)) return;

    const priceText = element.textContent.trim();
    const match = priceText.match(/(?:₪|ILS)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
    if (match) {
      const priceValue = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(priceValue) && priceValue > 0 && priceValue < 1000000000) {
        prices.push({value: priceValue, element: element});
      }
    }
  });

  if (prices.length > 4) {
    prices.sort((a, b) => a.value - b.value);
    const q1 = prices[Math.floor(prices.length / 4)].value;
    const q3 = prices[Math.ceil(prices.length * 3 / 4)].value;
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    prices = prices.filter(price => price.value >= lowerBound && price.value <= upperBound);
  }

  return prices;
}

function isInMainContent(element) {
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

  return (
    rect.left > viewportWidth * 0.1 &&
    rect.right < viewportWidth * 0.9
  );
}

function sendResult(prices) {
  chrome.runtime.sendMessage({
    action: "displayResult", 
    prices: prices.map(p => ({value: p.value}))
  });
}

function jumpToPrice(index) {
  if (index >= 0 && index < detectedPrices.length) {
    detectedPrices[index].element.scrollIntoView({behavior: "smooth", block: "center"});
    highlightElement(detectedPrices[index].element);
  }
}

function highlightElement(element) {
  const originalBackground = element.style.backgroundColor;
  const originalTransition = element.style.transition;
  element.style.transition = 'background-color 0.5s';
  element.style.backgroundColor = 'yellow';
  setTimeout(() => {
    element.style.backgroundColor = originalBackground;
    element.style.transition = originalTransition;
  }, 2000);
}