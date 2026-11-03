# Sanitizer probe

<img src=x onerror="window.__xss_img=1">

<script>window.__xss_script=1</script>

<iframe src="https://example.com"></iframe>

<iframe src="javascript:window.__xss_iframe=1"></iframe>

<a href="javascript:window.__xss_link=1">js link</a>

<b onclick="window.__xss_handler=1">bold with handler</b>

<svg onload="window.__xss_svg=1"></svg>

<math><mtext><script>window.__xss_math=1</script></mtext></math>

<object data="data:text/html,<script>parent.__xss_object=1</script>"></object>
