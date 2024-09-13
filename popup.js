let chart;

document.getElementById('selectElement').addEventListener('click', function() {
  injectContentScriptAndSendMessage("selectElement");
});

document.getElementById('analyzeButton').addEventListener('click', function() {
  injectContentScriptAndSendMessage("analyzePrices");
});

function injectContentScriptAndSendMessage(action) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      files: ['content.js']
    }, function() {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, {action: action});
    });
  });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "displayResult") {
    if (request.prices.length > 0) {
      const average = request.prices.reduce((sum, price) => sum + price.value, 0) / request.prices.length;
      document.getElementById('result').textContent = `Average price: ${average.toFixed(2)}`;
      
      updateChart(request.prices);
      displayPriceList(request.prices, average);
    } else {
      document.getElementById('result').textContent = "No valid prices found.";
      document.getElementById('chartContainer').style.display = 'none';
      document.getElementById('priceList').innerHTML = '';
    }
  }
});

function updateChart(prices) {
  const ctx = document.getElementById('chart').getContext('2d');
  
  if (chart) {
    chart.destroy();
  }
  
  const priceValues = prices.map(p => p.value);
  const labels = calculateHistogramBins(priceValues);
  const data = calculateHistogramData(priceValues, labels);

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Price Distribution',
        data: data,
        backgroundColor: 'rgba(0, 123, 255, 0.5)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 0 // Disable animations
      },
      scales: {
        y: {
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          display: false // Hide legend to save space
        }
      }
    }
  });

  document.getElementById('chartContainer').style.display = 'block';
}

function calculateHistogramBins(data) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const binCount = 10;
  const binSize = (max - min) / binCount;
  return Array.from({length: binCount}, (_, i) => (min + (i * binSize)).toFixed(2));
}

function calculateHistogramData(data, bins) {
  const counts = new Array(bins.length).fill(0);
  data.forEach(value => {
    const index = bins.findIndex(bin => value <= parseFloat(bin));
    if (index !== -1) counts[index]++;
  });
  return counts;
}

function displayPriceList(prices, average) {
  const priceListElement = document.getElementById('priceList');
  priceListElement.innerHTML = '<h3>Detected Prices:</h3>';
  
  prices.forEach((price, index) => {
    const priceItem = document.createElement('div');
    priceItem.className = 'price-item';

    const priceInfo = document.createElement('div');
    priceInfo.className = 'price-info';
    
    const priceValue = document.createElement('span');
    priceValue.textContent = `${price.value.toFixed(2)}`;
    priceInfo.appendChild(priceValue);

    const percentageDiff = ((price.value - average) / average) * 100;
    const percentageChip = document.createElement('span');
    percentageChip.className = 'percentage-chip';
    if (percentageDiff > 0) {
      percentageChip.classList.add('above-average');
      percentageChip.textContent = `+${percentageDiff.toFixed(1)}%`;
    } else if (percentageDiff < 0) {
      percentageChip.classList.add('below-average');
      percentageChip.textContent = `${percentageDiff.toFixed(1)}%`;
    } else {
      percentageChip.classList.add('at-average');
      percentageChip.textContent = '0%';
    }
    priceInfo.appendChild(percentageChip);

    priceItem.appendChild(priceInfo);
    
    const jumpButton = document.createElement('button');
    jumpButton.textContent = 'Jump to';
    jumpButton.className = 'jump-to';
    jumpButton.addEventListener('click', () => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "jumpTo", index: index});
      });
    });
    
    priceItem.appendChild(jumpButton);
    priceListElement.appendChild(priceItem);
  });
}