# OrderRescue dataset attribution

The real-day scenario uses actual invoice IDs, product codes and names, ordered quantities, arrival times of day, countries and unit prices in GBP from a UK online retailer. The simulator supplies the warehouses, inventory, commitments, deadlines, ready times, transfer costs and THB amounts. The hero scenario and all Thai chat messages are synthetic.

Chen, D. (2012). Online Retail II [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5CG6D.

The dataset is licensed under CC BY 4.0. The build uses the Kaggle CSV mirror of the UCI release. [UCI dataset](https://archive.ics.uci.edu/dataset/502/online+retail+ii) · [CC BY 4.0 licence](https://creativecommons.org/licenses/by/4.0/) · [CSV mirror](https://www.kaggle.com/datasets/mashlyn/online-retail-ii-uci)

Modified: filtered, date-shifted, customer ids replaced, simulated fields added.

## Slice and transformations

On 22 Nov 2011 the source CSV contains 3,967 rows. Removing cancellations, nonpositive quantities or prices, blank customers and non-product codes leaves 2,802 rows. Summing quantities for repeated invoice/product pairs gives 2,674 lines across 129 invoices and 1,190 SKUs. Prices agree within each merged pair. The most frequent trimmed description names each product, with ordinal text order breaking ties.

The demo shifts the order date to 21 Nov 2026 with the original times of day, 08:19–17:32, in Bangkok. Customer IDs are replaced by opaque references in arrival order. These references still allow purchases by the same customer to be linked. The whole day's order book is treated as known at 12:30. UK retail orders stand in for a Thai wholesaler. The performance difference between the two dispatch strategies depends on simulated inventory and costs.

Source CSV SHA-256 is `32569a66f3842a82b0d8c4d63b263c5d98a76bde5d1f65c6c01bf457e541d3a9`. Simulation seed is `20261121`. The committed JSON includes the complete config, source counts and per-field provenance.
