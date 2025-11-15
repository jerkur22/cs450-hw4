import React, { Component } from "react";
import * as d3 from "d3";

class InteractiveStreamGraph extends Component {
  componentDidUpdate() {
    const chartData = this.props.csvData;
    console.log("Rendering chart with data:", chartData);

    if (!chartData || chartData.length === 0) return;

    const llmModels = ["GPT-4", "Gemini", "PaLM-2", "Claude", "LLaMA-3.1"];

    const modelColors = {
      "GPT-4": "#e41a1c",
      Gemini: "#377eb8",
      "PaLM-2": "#4daf4a",
      Claude: "#984ea3",
      "LLaMA-3.1": "#ff7f00",
    };

    // tooltip div from notes
    let tooltip = d3.select("body").select(".llm-tooltip");
    if (tooltip.empty()) {
      tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "llm-tooltip")
        .style("background", "white")
        .style("border", "1px solid #ddd")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("padding", "10px")
        .style("box-shadow", "0 3px 5px rgba(0,0,0,0.4)")
        .style("display", "none");

      tooltip
        .append("svg")
        .attr("class", "tooltip-svg")
        .attr("width", 250)
        .attr("height", 150);
    }
    const tooltipSvg = tooltip.select("svg.tooltip-svg");

    const monthFormat = d3.timeFormat("%b");

    // parsing + cast to numbers from notes
    const data = chartData.map((row) => {
      const d = { ...row };
      d.Date = row.Date && new Date(row.Date);
      llmModels.forEach((m) => {
        d[m] = +d[m] || 0;
      });
      return d;
    });

    const svgWidth = 600;
    const svgHeight = 500;
    const margin = { top: 100, right: 170, bottom: 100, left: 20 };
    const innerWidth = svgWidth - margin.left - margin.right;
    const innerHeight = svgHeight - margin.top - margin.bottom;

    const xScale = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => d.Date))
      .range([0, innerWidth]);

    const colorScale = d3
      .scaleOrdinal()
      .domain(llmModels)
      .range(llmModels.map((m) => modelColors[m]));

    // stack with wiggle offset -> streamgraph from notes
    const stackLayout = d3.stack().keys(llmModels).offset(d3.stackOffsetWiggle);
    const stackedSeries = stackLayout(data);

    // y domain directly from stacked data 
    const yScale = d3
      .scaleLinear()
      .domain([
        d3.min(stackedSeries, (layer) => d3.min(layer, (p) => p[0])),
        d3.max(stackedSeries, (layer) => d3.max(layer, (p) => p[1])),
      ])
      .range([innerHeight, 0]);

    // area generator 
    const areaGen = d3
      .area()
      .x((d) => xScale(d.data.Date))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]))
      .curve(d3.curveCardinal);

    const svg = d3
      .select(".svg_parent")
      .attr("width", svgWidth)
      .attr("height", svgHeight);

    const mainGroup = svg
      .selectAll(".chart-group")
      .data([null])
      .join("g")
      .attr("class", "chart-group")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // mini bar chart inside tooltip
    const renderMiniBarChart = (modelKey) => {
      const modelData = data.map((d) => ({
        monthLabel: monthFormat(d.Date),
        value: d[modelKey],
      }));

      const miniWidth = 220;
      const miniHeight = 140;
      const miniMargin = { top: 15, right: 10, bottom: 30, left: 35 };
      const w = miniWidth - miniMargin.left - miniMargin.right;
      const h = miniHeight - miniMargin.top - miniMargin.bottom;

      // more padding so bars have visible gaps, had to fiddle with this
      const xMini = d3
        .scaleBand()
        .domain(modelData.map((d) => d.monthLabel))
        .range([0, w])
        .padding(0.25);

      const maxVal = d3.max(modelData, (d) => d.value);
      // plain linear scale like notes, just using maxVal
      const yMini = d3
        .scaleLinear()
        .domain([0, maxVal])
        .range([h, 0]);

      const miniGroup = tooltipSvg
        .selectAll(".mini-group")
        .data([null])
        .join("g")
        .attr("class", "mini-group")
        .attr("transform", `translate(${miniMargin.left},${miniMargin.top})`);
      miniGroup
        .selectAll("rect")
        .data(modelData)
        .join("rect")
        .attr("x", (d) => xMini(d.monthLabel))
        .attr("y", (d) => yMini(d.value))
        .attr("width", xMini.bandwidth())
        .attr("height", (d) => h - yMini(d.value))
        .attr("fill", modelColors[modelKey]);
      miniGroup
        .selectAll(".mini-x-axis")
        .data([null])
        .join("g")
        .attr("class", "mini-x-axis")
        .attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(xMini));
      miniGroup
        .selectAll(".mini-y-axis")
        .data([null])
        .join("g")
        .attr("class", "mini-y-axis")
        .call(d3.axisLeft(yMini).ticks(5)); // ticks standard
    };

    // streamgraph layers
    mainGroup
      .selectAll(".stream-layer")
      .data(stackedSeries)
      .join("path")
      .attr("fill", (d) => colorScale(d.key))
      .attr("stroke", "none")
      .attr("class", "stream-layer")
      .attr("d", (d) => areaGen(d))
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        renderMiniBarChart(d.key);
        tooltip.style("display", "block");
      })
      .on("mousemove", (event) => {
        // small offset so tooltip isn’t directly under cursor
        tooltip
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY + 10 + "px");
      })
      .on("mouseout", () => {
        tooltip.style("display", "none");
      });

    // x-axis 
    const axisOffset = 10;
    mainGroup
      .selectAll(".x-axis")
      .data([null])
      .join("g") // join g like notes
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight + axisOffset})`)
      .call(
        d3.axisBottom(xScale).ticks(d3.timeMonth.every(1)).tickFormat(monthFormat)
      );

    // legend on right 
    const legendModels = [...llmModels].reverse();
    const legendItemHeight = 20;
    const legendHeight = legendModels.length * legendItemHeight;
    const legendOffsetY = (innerHeight - legendHeight) / 2;

    const legendGroup = svg
      .selectAll(".legend-group")
      .data([null])
      .join("g")
      .attr("class", "legend-group")
      .attr(
        "transform",
        `translate(${margin.left + innerWidth + 20}, ${
          margin.top + legendOffsetY
        })`
      );

    legendGroup
      .selectAll(".legend-item")
      .data(legendModels)
      .join("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * legendItemHeight})`)
      .selectAll("rect")
      .data((d) => [d])
      .join("rect")
      .attr("width", 13)
      .attr("height", 13)
      .attr("fill", (d) => modelColors[d])
      .selectAll("text")
      .data((d) => [d])
      .join("text")
      .attr("x", 20)
      .attr("y", 10)
      .style("fontSize", "12px")
      .text((d) => d);
  }

  render() {
    return (
      <svg style={{ width: 600, height: 500 }} className="svg_parent" ></svg>
    );
  }
}

export default InteractiveStreamGraph;
