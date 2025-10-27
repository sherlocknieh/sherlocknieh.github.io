---
permalink: /posts
title: 文章列表
---

# 所有文章

{% assign posts_per_page = 5 %}
{% assign total_posts = site.posts.size %}

{% for post in site.posts limit: posts_per_page %}
- [{{ post.title }} {{ post.date | date: "%Y-%m-%d" }}]({{ post.url }})

{% endfor %}

共 {{ total_posts }} 篇文章