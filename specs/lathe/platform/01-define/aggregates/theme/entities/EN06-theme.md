---
id: LA-PLT-EN06
kind: entity
title: Theme
parent: LA-PLT-A4
role: root
---
One theme: a named set of token values with a light set and a dark set.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Name | What the theme is called. | Text, unique among the person's themes. | High contrast |
| Built in | Whether Lathe ships it, so it is never changed. | Yes or no. | yes |
| Light and dark tokens | The colors for each color mode. | Two maps from token name to value. | --bg: #ffffff |
| Shared tokens | Type, shape, density and motion, for both modes. | Map from token name to value. | --radius: 6px |
