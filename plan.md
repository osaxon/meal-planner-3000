# Meal Planner 3000

A meal planning tool that helps schedule meals using user defined meals.

## High level use case

The idea behind the app is to take the pain away from thinking what to make throughout the week. Most of the time we end up having the same handful of meals over a 2-4 week cycle, but struggle to know what to order when shopping when we don't know what we'll be making that week.

This tool aims to help with planning whilst keeping things simple. Not full recipes with instructions, just the ingredients required to make the meal - the idea is these are known recipes.

## Features

Core features of the tool

### Meal scheduler

This is the main feature. A scheduling tool which picks meals from the list and assigns a meal for the days of the week ahead. The scheduler has smart features that make sure variety is added to schedules, and also takes into consideration other properties of the meal, such as seasonality i.e. more salads or fresh meals in summer, soups in autumn etc.

The schedule can plan for 1, 2 or 4 week schedules.

### Schedule / user preferences

A schedule can be customised and configured to place meals on certain days of the week. For example, weekdays only, evening meals only, evening and lunch, weekdays and weekends, or omit certain dates. 
There should also be preferences to select more vegetarean or meat based, or more high fiber meals for a given schedule. This should be configurable per schedule.

### Meal Pool

The meal pool is the collection of user defined meals. Each meal should should be categorised and should specify the ingredients required. 
The meals in the pool should also have other meta information to support with scheduling.
Some ideas for meta information about a meal:
- diet - meat or veggie
- season - year round, spring/summer, BBQ, autumn/winter, festive
- producesLeftovers - this would be true for a meal that is cooked as a large portion that gives more than 1 meal each
- tags - list of free form tags

