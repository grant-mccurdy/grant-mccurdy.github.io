# Reproduce the report's ggplot2 violin and boxplot statistics, without identifiers.
library(ggplot2)
library(jsonlite)
args <- commandArgs(trailingOnly=TRUE)
d <- read.csv(args[[1]], check.names=FALSE)
orders <- fromJSON(args[[2]])$course_order
d$course <- factor(d$course, levels=orders)
d$track <- factor(d$track, levels=c("Regular", "Honors/AP"))
groups <- unique(d[c("course", "track")])
groups <- groups[order(groups$course, groups$track),]
result <- lapply(seq_len(nrow(groups)), function(i) {
  group <- groups[i,]
  x <- d$score[d$course == group$course & d$track == group$track]
  frame <- data.frame(group="scores", score=x)
  violin <- ggplot_build(ggplot(frame, aes(group, score)) +
    geom_violin(scale="width", trim=TRUE))$data[[1]]
  if ("quantile" %in% names(violin)) violin <- violin[is.na(violin$quantile),]
  violin <- violin[order(violin$y),]
  box <- ggplot_build(ggplot(frame, aes(group, score)) +
    geom_boxplot())$data[[1]]
  counts <- tabulate(as.integer(round(x * 30 / 100)) + 1L, nbins=31)
  list(course=as.character(group$course), track=as.character(group$track),
    n=length(x), mean=mean(x), sd=sd(x), min=min(x), max=max(x),
    q1=box$lower, median=box$middle, q3=box$upper,
    whisker_low=box$ymin, whisker_high=box$ymax, outliers=I(unname(box$outliers[[1]])),
    counts=counts,
    density=unname(Map(function(y,w)c(y,w), violin$y, violin$violinwidth)))
})
cat(toJSON(list(engine=paste0("ggplot2 ",packageVersion("ggplot2")),
  groups=result), auto_unbox=TRUE, digits=12, null="null"))
