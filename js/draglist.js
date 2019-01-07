var draglist = {
    create: function (argElementSelector){
      $(argElementSelector).each(function(index, element){
        $('#' + element.id).attr('draggable', true);
        element.addEventListener('dragstart', handleDragStart);
      	element.addEventListener('drop', handleDrop);
      	element.addEventListener('dragenter', cancelEvent);
      	element.addEventListener('dragover', cancelEvent);
      });
    },
};

function handleDragStart(e){
  console.log('start drag');
  console.log(e);
  //e.currentTarget.style.background = "gray";
  //$(e.target).css('background-color', 'red');
	e.dataTransfer.setData('text/html', e.target.id);
  e.target.style.color = "red";
  e.dataTransfer.setDragImage(e.target, 20, 20);
}

function cancelEvent(e){
	e.preventDefault();
}

function handleDrop(e){
	var sourceId = e.dataTransfer.getData('text');
	var source = document.getElementById(sourceId);
	var sourceHTML = source.innerHTML;

	var target = e.currentTarget;
	var targetHTML = target.innerHTML;

	target.innerHTML = sourceHTML;
	source.innerHTML = targetHTML;

	e.preventDefault();
}
