<!-- Stripe Checkout -->
<donation>
  <form action="https://l2rtool-donation.glitch.me" class="donation-form" method="POST"></form>
  <script type="text/javascript">
    var initializedDonation = false;
    var initializedApplepayDonation = false;
    var initApplepayDonation = function() {
      if (initializedApplepayDonation) {
        return;
      }
      initializedApplepayDonation = true;
      var script = document.createElement( 'script' );
      script.type = 'text/javascript';
      script.src = '';
      var firstScript = document.getElementsByTagName( 'script' )[ 0 ];
      firstScript.parentNode.insertBefore( script, firstScript );
      var stripe = Stripe('pk_live_JlhrlmDnSu9qzPjvJ5eqjSro');
      var paymentRequest = stripe.paymentRequest({
        country: 'JP',
        currency: 'jpy',
        total: {
          label: '寄付',
          amount: 1000,
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });
      var elements = stripe.elements();
      var prButton = elements.create('paymentRequestButton', {
        paymentRequest: paymentRequest,
      });
      try {
        // Check the availability of the Payment Request API first.
        paymentRequest.canMakePayment().then(function(result) {
          if (result) {
            $('donation').prepend('<div id="payment-request-button"></div>').ready(function (){
              prButton.mount('#payment-request-button');
            });
          }
        });
      }
      catch (error) {
        console.log(error);
      }
      paymentRequest.on('token', function(ev) {
        $.ajax({
          url: 'https://l2rtool-donation.glitch.me',
          type: 'POST',
          dataType: 'text',
          data: 'stripeToken='+ev.token.id+'&applepay=true',
        })
        .done((data) => {
          //成功した場合の処理
          console.log(data);
          ev.complete('success');
          var message = '寄付に感謝致します！！';
          if ('undefined' != typeof getParams['clanid'] && 0 < getParams['clanid'].length && '56fhe8sie5UrrZUWVz9V' != getParams['clanid']) {
            message = message + '\n寄付により血盟管理ツールでの公告表示が無効化されます。\n再度表示させたい場合はお手数ですが<a href="#inquiry">お問い合わせ</a>下さい。';
            loading(true);
            firebase.firestore().collection("clans").doc(getParams['clanid']).update({donate:true,addisabled:true}).then(function(snapshot){
              loading(false);
            });
          }
          else {
            message = message + '\n\n寄付により血盟管理ツールでの公告表示が無効化出来ます。\n無効化をご希望の場合はお手数ですが<a href="#inquiry">お問い合わせ</a>下さい。';
          }
          var alertDiv = document.createElement("div");
          alertDiv.insertAdjacentHTML('beforeend', '<br/>' + message.replace(/\r?\n/g, '<br/>'));
          swal({ content: alertDiv, icon: 'success',});
        })
        .fail((data) => {
          //失敗した場合の処理
          console.log(data);
          ev.complete('fail');
          swal({ text: 'すみません、決済に失敗しました・・・', icon: 'error',});
        });
      });
      firstView = true;
    };
    this.on('mount', function() {
      if (!initializedDonation) {
        initializedDonation = true;
        if ('undefined' != typeof getParams['clanid'] && 0 < getParams['clanid'].length && '56fhe8sie5UrrZUWVz9V' != getParams['clanid'] && 'undefined' != typeof getParams['donated'] && 0 < getParams['donated'].length) {
          var message = '寄付に感謝致します！！';
          if ('undefined' != typeof getParams['clanid'] && 0 < getParams['clanid'].length && '56fhe8sie5UrrZUWVz9V' != getParams['clanid']) {
            message = message + '\n寄付により血盟管理ツールでの公告表示が無効化されます。\n再度表示させたい場合はお手数ですが<a href="#inquiry">お問い合わせ</a>下さい。';
          }
          else {
            message = message + '\n\n寄付により血盟管理ツールでの公告表示が無効化出来ます。\n無効化をご希望の場合はお手数ですが<a href="#inquiry">お問い合わせ</a>下さい。';
          }
          var alertDiv = document.createElement("div");
          alertDiv.insertAdjacentHTML('beforeend', '<br/>' + message.replace(/\r?\n/g, '<br/>'));
          swal({ content: alertDiv, icon: 'success',});
        }
        $.getScript('https://js.stripe.com/v3/', function(){
          initApplepayDonation();
          $('<script>')
          .attr('src', 'https://checkout.stripe.com/checkout.js')
          .attr('class', 'stripe-button')
          .attr('data-key', 'pk_live_JlhrlmDnSu9qzPjvJ5eqjSro')
          .attr('data-email', 'saimushi@gmial.com')
          .attr('data-name', 'L2R Tool')
          .attr('data-description', '寄付を・・・お願いしますm(_ _)m')
          .attr('data-image', './images/titlelogo.png')
          .attr('data-label', '寄付する')
          .attr('data-amount', '1000')
          .attr('data-locale', 'auto')
          .attr('data-allow-remember-me', 'false')
          .attr('data-panel-label', '{{amount}}寄付する')
          .attr('data-currency', 'jpy')
          .appendTo('.donation-form');
        });
      }
    });
  </script>
</donation>
