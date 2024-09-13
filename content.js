let selectedElement = null;
let detectedPrices = [];

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "selectElement") {
    startElementSelection(request.useEnhancedDetection);
  } else if (request.action === "analyzePrices") {
    analyzePrices(request.useEnhancedDetection);
  } else if (request.action === "jumpTo") {
    jumpToPrice(request.index);
  }
});

function startElementSelection(useEnhancedDetection) {
  document.body.style.cursor = 'crosshair';
  document.addEventListener('click', (e) => selectElement(e, useEnhancedDetection), {once: true});
}

function selectElement(e, useEnhancedDetection) {
  e.preventDefault();
  selectedElement = e.target;
  document.body.style.cursor = 'default';
  calculateAverageForSelected(useEnhancedDetection);
}

function calculateAverageForSelected(useEnhancedDetection) {
  if (!selectedElement) return;

  const tagName = selectedElement.tagName;
  const className = selectedElement.className;
  const similarElements = document.querySelectorAll(`${tagName}.${className}`);
  
  detectedPrices = extractPrices(similarElements, useEnhancedDetection);
  sendResult(detectedPrices);
}

function analyzePrices(useEnhancedDetection) {
  let priceElements;
  if (useEnhancedDetection) {
    priceElements = document.querySelectorAll([
      'span[class*="x193iq5w"][class*="xeuugli"][class*="x13faqbe"]',
      'div[data-test-id="price_value"]',
      'div[class*="PriceData"]',
      '.s-item__price',
      // General price selectors
      '[class*="price"]',
      '[class*="cost"]',
      '[class*="amount"]',
      '[itemprop="price"]'
    ].join(','));
  } else {
    priceElements = document.querySelectorAll('[class*="price"], [class*="cost"], [class*="amount"], [itemprop="price"]');
  }
  detectedPrices = extractPrices(priceElements, useEnhancedDetection);
  sendResult(detectedPrices);
}

function extractPrices(elements, useEnhancedDetection) {
  let prices = [];

  elements.forEach((element) => {
    if (!isInMainContent(element)) return;

    const priceText = element.textContent.trim();
    // Regex to match various price formats including those with currency symbols or codes
    const match = priceText.match(/^(₪|£|\$|€|ILS|USD|GBP|EUR)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)(?:\s*(₪|£|\$|€|ILS|USD|GBP|EUR))?$/);

    if (match) {
      let currencySymbol = match[1] || match[3] || '';
      const priceValue = parseFloat(match[2].replace(/,/g, ''));
      if (!isNaN(priceValue) && priceValue > 0 && priceValue < 1000000000) {
        let currency = 'USD'; // Default currency
        if (currencySymbol === '₪' || currencySymbol.toLowerCase() === 'ils') {
          currency = 'ILS';
        } else if (currencySymbol === '£' || currencySymbol.toLowerCase() === 'gbp') {
          currency = 'GBP';
        } else if (currencySymbol === '€' || currencySymbol.toLowerCase() === 'eur') {
          currency = 'EUR';
        }
        
        if (!useEnhancedDetection || isLikelyPrice(element, priceValue)) {
          prices.push({value: priceValue, currency: currency, element: element});
        }
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

function isLikelyPrice(element, value) {
  // For Facebook Marketplace and yad2.co.il, we trust the specific selectors
  if (element.matches('span[class*="x193iq5w"][class*="xeuugli"][class*="x13faqbe"]') ||
      element.matches('div[data-test-id="price_value"]') ||
      element.matches('div[class*="PriceData"]')) {
    return true;
  }

  const relevantElement = element.closest('[class*="price"], [class*="cost"], [class*="amount"], [itemprop="price"]');
  if (relevantElement) return true;

  if (value < 100 && Number.isInteger(value)) return false;

  const surroundingText = element.parentElement.textContent.toLowerCase();
  const priceKeywords = ['price', 'cost', 'total', 'subtotal', 'מחיר', 'עלות', 'סה״כ'];
  if (priceKeywords.some(keyword => surroundingText.includes(keyword))) return true;

  return false;
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
    prices: prices.map(p => ({value: p.value, currency: p.currency}))
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
