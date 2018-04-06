var colorHash = new ColorHash();

$(document).ready(function() {
	$('.hashnode-id-color').each(function() {
		seed = $(this).text().substring(0, 30);
		$(this).css('color',colorHash.hex(seed))
	})

	$('.hash-id-color').each(function() {
		seed = $(this).text().substring(0, 30);
		$(this).css('color', colorHash.hex(seed))
	})

	$('.invoice-json').hide()

	$('.invoice-debug').click(function() {
		$('.invoice-json').toggle()
	})
})